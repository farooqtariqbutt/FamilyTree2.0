
import React, { useState, useCallback, useEffect } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { useFamilyTreeContext } from '../../hooks/useFamilyTree.ts';
import { getAncestorsWithRelationship } from '../../utils/reportUtils.ts';
import { calculateAge } from '../../utils/dateUtils.ts';
import { getFullName } from '../../utils/personUtils.ts';
import { Gender, type Person } from '../../types.ts';
import Button from '../ui/Button.tsx';
import SearchableSelect from '../ui/SearchableSelect.tsx';
import { PrintIcon, SpinnerIcon, MaleSymbolIcon, FemaleSymbolIcon, UserIcon } from '../ui/Icons.tsx';


const AncestorsReport = () => {
    const { people, getPersonById } = useFamilyTreeContext();
    const [personId, setPersonId] = useState('');
    const [ancestorReportData, setAncestorReportData] = useState<{ rootPerson: Person, ancestors: { person: Person, relationship: string }[] } | null>(null);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    const handleGenerateAncestorReport = useCallback(() => {
        if (!personId) return;
        const person = getPersonById(personId);
        if (person) {
            const ancestors = getAncestorsWithRelationship(person, people);
            setAncestorReportData({ rootPerson: person, ancestors });
        }
    }, [personId, getPersonById, people]);

    useEffect(() => {
        if (personId) {
            handleGenerateAncestorReport();
        } else {
            setAncestorReportData(null);
        }
    }, [personId, handleGenerateAncestorReport]);
    
     const handleDownloadAncestorReport = async () => {
        if (!ancestorReportData) return;
        
        setIsGeneratingPdf(true);
        const { rootPerson, ancestors } = ancestorReportData;
        const fileName = `Ancestor_Report_for_${getFullName(rootPerson)}`;
        
        const doc = new jsPDF('p', 'mm', 'a4');
        const summaryCardEl = document.getElementById('summary-card-ancestors');
        const pageHeight = doc.internal.pageSize.getHeight();
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 10;
        
        if (!summaryCardEl) {
            alert('Could not find summary card to print.');
            setIsGeneratingPdf(false);
            return;
        }

        try {
            const summaryCanvas = await html2canvas(summaryCardEl, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                onclone: (clonedDoc) => {
                    clonedDoc.documentElement.classList.remove('dark');
                    const style = clonedDoc.createElement('style');
                    style.innerHTML = `
                        #summary-card-ancestors { font-size: 12pt !important; line-height: 1.5 !important; }
                        #summary-card-ancestors h4 { font-size: 14pt !important; }
                        #summary-card-ancestors .text-sm { font-size: 12pt !important; }
                        .bg-male { background-color: #eff6ff !important; }
                        .bg-female { background-color: #fce7f3 !important; }
                        .bg-gray-50 { background-color: #f9fafb !important; }
                        * { box-shadow: none !important; animation: none !important; transition: none !important; }
                    `;
                    clonedDoc.head.appendChild(style);
                }
            });
            const summaryImgData = summaryCanvas.toDataURL('image/jpeg', 1.0);
            const summaryImgProps = doc.getImageProperties(summaryImgData);
            const summaryImgWidth = pageWidth - margin * 2;
            const summaryImgHeight = (summaryImgProps.height * summaryImgWidth) / summaryImgProps.width;
    
            const tableColumns = ['Status', 'Name', 'Relationship', 'Birth Date', 'Death Date', 'Age'];
            const tableRows = ancestors.map(({ person, relationship }) => {
                let statusText;
                if (person.deathDate) {
                    statusText = 'Deceased';
                } else if (person.birthDate) {
                    statusText = 'Alive';
                } else {
                    statusText = 'Unknown';
                }
                return [
                    statusText,
                    getFullName(person),
                    relationship,
                    person.birthDate || 'N/A',
                    person.deathDate || 'N/A',
                    calculateAge(person.birthDate, person.deathDate)
                ];
            });
            const headerHeight = 15 + summaryImgHeight + 5;
    
            autoTable(doc, {
                head: [tableColumns],
                body: tableRows,
                startY: headerHeight,
                theme: 'grid',
                headStyles: { fillColor: [59, 130, 246], textColor: [0, 0, 0], fontStyle: 'bold' },
                didDrawPage: (data) => {
                    doc.setFontSize(18);
                    doc.setFont('helvetica', 'bold');
                    doc.text('Ancestor Report', margin, 15);
                    doc.addImage(summaryImgData, 'JPEG', margin, 20, summaryImgWidth, summaryImgHeight);
                },
                didParseCell: (data) => {
                    const person = ancestors[data.row.index]?.person;
                    if (person) {
                        if (person.gender === Gender.Male) {
                            data.cell.styles.fillColor = [239, 246, 255];
                        } else if (person.gender === Gender.Female) {
                            data.cell.styles.fillColor = [252, 231, 243];
                        }
                    }
                },
                margin: { top: 20 + summaryImgHeight + 5 }
            });

            const pageCount = (doc as any).internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setTextColor(150);
                const dateTime = new Date().toLocaleString();
                doc.text(dateTime, margin, pageHeight - 5);
                const pageNumText = `Page ${i} of ${pageCount}`;
                const textWidth = doc.getStringUnitWidth(pageNumText) * doc.getFontSize() / doc.internal.scaleFactor;
                doc.text(pageNumText, pageWidth - margin - textWidth, pageHeight - 5);
            }
    
            doc.save(`${fileName.replace(/\s/g, '_')}.pdf`);

        } catch (error) {
            console.error("Error generating ancestor report PDF:", error);
            alert("Sorry, an error occurred while generating the PDF report.");
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    return (
        <div className="report-container">
            <h3 className="text-xl font-semibold mb-4">Ancestor Report</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Select an individual to generate a list of all their known direct ancestors.
            </p>
            <div className="flex items-end space-x-2 mb-4 no-print">
                <div className="flex-grow max-w-sm">
                    <SearchableSelect
                        label="Select Person"
                        options={people}
                        value={personId}
                        onChange={setPersonId}
                        placeholder="Select a person"
                    />
                </div>
                {ancestorReportData && (
                     <Button onClick={handleDownloadAncestorReport} disabled={isGeneratingPdf}>
                         {isGeneratingPdf ? <SpinnerIcon /> : <PrintIcon />}
                         <span className="ml-2 hidden sm:inline">{isGeneratingPdf ? 'Generating...' : 'Download Report'}</span>
                     </Button>
                )}
            </div>

            {ancestorReportData && (
                 <div className="animate-fadeIn">
                    <div id="summary-card-ancestors" className={`p-4 border rounded-lg mb-6 ${
                        ancestorReportData.rootPerson.gender === Gender.Male ? 'bg-male dark:bg-male-dark' :
                        ancestorReportData.rootPerson.gender === Gender.Female ? 'bg-female dark:bg-female-dark' :
                        'bg-gray-50 dark:bg-gray-800/50'
                    }`}>
                        <h4 className="text-lg font-semibold mb-2">Report for: {getFullName(ancestorReportData.rootPerson)}</h4>
                         <div className="flex items-start space-x-4">
                            <div className="flex-shrink-0 w-24 h-32 rounded-md flex items-center justify-center bg-gray-200 dark:bg-gray-700 overflow-hidden">
                                {ancestorReportData.rootPerson.photos?.[0] ? <img src={ancestorReportData.rootPerson.photos[0]} alt={getFullName(ancestorReportData.rootPerson)} className="w-full h-full object-cover" />
                                    : (
                                        <>
                                            {ancestorReportData.rootPerson.gender === Gender.Male && <MaleSymbolIcon />}
                                            {ancestorReportData.rootPerson.gender === Gender.Female && <FemaleSymbolIcon />}
                                            {ancestorReportData.rootPerson.gender !== Gender.Male && ancestorReportData.rootPerson.gender !== Gender.Female && <UserIcon />}
                                        </>
                                    )}
                            </div>
                            <div className="text-sm">
                                <p><strong>Born:</strong> {ancestorReportData.rootPerson.birthDate || 'N/A'} {ancestorReportData.rootPerson.birthPlace && `in ${ancestorReportData.rootPerson.birthPlace}`}</p>
                                {ancestorReportData.rootPerson.deathDate && <p><strong>Died:</strong> {ancestorReportData.rootPerson.deathDate} {ancestorReportData.rootPerson.deathPlace && `in ${ancestorReportData.rootPerson.deathPlace}`}</p>}
                                <p className="mt-2">Total Ancestors Found: {ancestorReportData.ancestors.length}</p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="overflow-x-auto">
                         <table className="w-full text-left text-sm">
                            <thead className="bg-gray-100 dark:bg-gray-800">
                                <tr>
                                    {['Photo', 'Status', 'Name', 'Relationship', 'Birth Date', 'Death Date', 'Age'].map((header, i) =>
                                        <th key={header} className={`p-3 font-semibold text-gray-600 dark:text-gray-300 tracking-wider ${i === 1 ? 'text-center' : ''}`}>{header}</th>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                                {ancestorReportData.ancestors.map(({ person, relationship }) => {
                                    const genderClass = person.gender === Gender.Male ? 'bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100' : person.gender === Gender.Female ? 'bg-pink-50 dark:bg-pink-900/20 hover:bg-pink-100' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50';
                                    const lineageClass = relationship.includes('Paternal') ? 'border-blue-500' : relationship.includes('Maternal') ? 'border-pink-500' : 'border-transparent';

                                    let statusDot;
                                    if (person.deathDate) {
                                        statusDot = <div className="w-3 h-3 bg-red-500 rounded-full inline-block" title="Deceased"></div>;
                                    } else if (person.birthDate) {
                                        statusDot = <div className="w-3 h-3 bg-green-500 rounded-full inline-block" title="Alive"></div>;
                                    } else {
                                        statusDot = <div className="w-3 h-3 bg-gray-400 rounded-full inline-block" title="Unknown Status"></div>;
                                    }

                                    return (
                                    <tr key={person.id} className={genderClass}>
                                        <td className="p-2">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-gray-200 dark:bg-gray-700 overflow-hidden border-2 ${lineageClass}`}>
                                                {person.photos?.[0] ? 
                                                    <img src={person.photos[0]} alt={getFullName(person)} className="w-full h-full object-cover" /> : 
                                                    <UserIcon className="w-6 h-6 text-gray-400" />
                                                }
                                            </div>
                                        </td>
                                        <td className="p-3 text-center align-middle">{statusDot}</td>
                                        <td className="p-3 font-medium">{getFullName(person)}</td>
                                        <td className="p-3">{relationship}</td>
                                        <td className="p-3">{person.birthDate || 'N/A'}</td>
                                        <td className="p-3">{person.deathDate || 'N/A'}</td>
                                        <td className="p-3">{calculateAge(person.birthDate, person.deathDate)}</td>
                                    </tr>
                                )})}
                            </tbody>
                        </table>
                    </div>
                 </div>
            )}
        </div>
    );
};

export default AncestorsReport;
