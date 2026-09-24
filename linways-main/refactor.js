const fs = require('fs');

const path = 'src/app/staff/complete-profile/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add useRouter import if missing
if (!content.includes('useRouter')) {
    content = content.replace('import Link from "next/link";', 'import Link from "next/link";\nimport { useRouter } from "next/navigation";');
}

// 2. Add router hook inside component
if (!content.includes('const router = useRouter();')) {
    content = content.replace('export default function CompleteProfilePage() {', 'export default function CompleteProfilePage() {\n    const router = useRouter();');
}

// 3. Replace all the handlers with a single handleSaveProfile
const handlersStart = content.indexOf('const handleAddQualification = async () => {');
const handlersEnd = content.indexOf('if (loading) {');

const handleSaveProfileCode = `
    const handleSaveProfile = async () => {
        if (!user?.uid) return;
        setUpdating(true);
        try {
            const updatedData: any = {};
            const updatedQuals = [...(staff.qualifications || [])];
            if (newQual.degree && newQual.institution) {
                updatedQuals.push(newQual);
            }
            if (updatedQuals.length > 0) {
                updatedData.qualifications = updatedQuals;
            }

            const updatedExps = [...(staff.experiences || [])];
            const hasDuration = !!newExp.duration;
            const hasDates = !!newExp.fromDate && (!!newExp.toDate || newExp.isCurrent);
            if (newExp.role && newExp.company && (hasDuration || hasDates)) {
                updatedExps.push(newExp);
            }
            if (updatedExps.length > 0) {
                updatedData.experiences = updatedExps;
            }

            if (Object.keys(updatedData).length > 0) {
                await updateDoc(doc(db, "users", user.uid), updatedData);
                setStaff({ ...staff, ...updatedData });
            }
            
            router.push(dashboardHref);
        } catch (err) {
            console.error("Error saving profile", err);
            alert("Error saving profile");
        }
        setUpdating(false);
    };

    `;

content = content.slice(0, handlersStart) + handleSaveProfileCode + content.slice(handlersEnd);

// 4. Remove Add/Cancel buttons in headers
content = content.replace(/<button[\s\S]*?onClick=\{\(\) => \{\s*setIsAddingQual\(!isAddingQual\);[\s\S]*?<\/button>/, '');
content = content.replace(/<button[\s\S]*?onClick=\{\(\) => \{\s*setIsAddingExp\(!isAddingExp\);[\s\S]*?<\/button>/, '');

// 5. Remove the {isAddingQual && ( ... )} wrappers
content = content.replace(/\{isAddingQual && \(\s*<div className="mb-4 p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-3">/, '<div className="mb-4 p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-3">');
content = content.replace(/<\/button>\s*<\/div>\s*<\/div>\s*\)\}/, '</div>\n                                </div>');

content = content.replace(/\{isAddingExp && \(\s*<div className="mb-4 p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-3">/, '<div className="mb-4 p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-3">');
content = content.replace(/<\/button>\s*<\/div>\s*\)\}/, '</div>');

// 6. Remove inner Save buttons
content = content.replace(/<button\s*onClick=\{handleAddQualification\}[\s\S]*?<\/button>/, '');
content = content.replace(/<button\s*onClick=\{handleAddExperience\}[\s\S]*?<\/button>/, '');

// 7. Remove the list of existing qualifications and experiences
const qualListStart = content.indexOf('<div className="space-y-3">');
const qualListEnd = content.indexOf('</div>', content.indexOf('Trash2', qualListStart)) + 120; // rough estimation
// better to use regex for the whole space-y-3 div
content = content.replace(/<div className="space-y-3">\s*\{\(!staff\.qualifications[\s\S]*?\}\s*<\/div>/, '');
content = content.replace(/<div className="space-y-3">\s*\{\(!staff\.experiences[\s\S]*?\}\s*<\/div>/, '');

// 8. Replace "Done" link with "Save Profile" button
const doneButtonHtml = `
                    <button 
                        onClick={handleSaveProfile} 
                        disabled={updating}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                        {updating ? 'Saving...' : 'Save & Continue'}
                    </button>`;
content = content.replace(/<Link href=\{dashboardHref\} className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors">\s*Done\s*<\/Link>/, doneButtonHtml);

fs.writeFileSync(path, content);
console.log('Refactored page successfully.');
