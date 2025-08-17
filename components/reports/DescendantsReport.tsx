
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { useFamilyTreeContext } from '../../hooks/useFamilyTree.ts';
import { getDescendantsWithRelationship } from '../../utils/reportUtils.ts';
import { calculateAge } from '../../utils/dateUtils.ts';
import { getFullName } from '../../utils/personUtils.ts';
import { Gender, type Person } from '../../types.ts';
import Button from '../ui/Button.tsx';
import SearchableSelect from '../ui/SearchableSelect.tsx';
import { PrintIcon, SpinnerIcon, MaleSymbolIcon, FemaleSymbolIcon, UserIcon } from '../ui/Icons.tsx';

type DescendantReportData = {
    rootPerson: Person;
    descendants: { person: Person, relationship: string, generation: number }[];
};

const DescendantsReport = () => {
    const { people, getPersonById, configureTreeView } = useFamilyTreeContext();
    const navigate = useNavigate();
    const [personId, setPersonId] = useState('');
    const [descendantReportData, setDescendantReportData] = useState<DescendantReportData | null>(null);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    const handleGenerateDescendantReport = useCallback(() => {
        if (!personId) return;
        const person = getPersonById(personId);
        if (person) {
            const descendants = getDescendantsWithRelationship(person, people);
            
            const sortedDescendants = descendants.sort((a, b) => {
                if (a.generation !== b.generation) return a.generation - b.generation;
                const dateA = a.person.birthDate ? new Date(a.person.birthDate).getTime() : Infinity;
                const dateB = b.person.birthDate ? new Date(b.person.birthDate).getTime() : Infinity;
                if (dateA === Infinity && dateB === Infinity) return getFullName(a.person).localeCompare(getFullName(b.person));
                return dateA - dateB;
            });

            setDescendantReportData({ rootPerson: person, descendants: sortedDescendants });
        }
    }, [personId, getPersonById, people]);

    useEffect(() => {
        if (personId) {
            handleGenerateDescendantReport();
        } else {
            setDescendantReportData(null);
        }
    }, [personId, handleGenerateDescendantReport]);
    
    const handleDownloadDescendantReport = async () => {
        if (!descendantReportData) return;
        
        setIsGeneratingPdf(true);
        const { rootPerson, descendants } = descendantReportData;
        const fileName = `Descendant_Report_for_${getFullName(rootPerson)}`;
        
        const doc = new jsPDF('p', 'mm', 'a4');
        const summaryCardEl = document.getElementById('summary-card-descendants');
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
                        #summary-card-descendants { font-size: 12pt !important; line-height: 1.5 !important; }
                        #summary-card-descendants h4 { font-size: 14pt !important; }
                        #summary-card-descendants .text-sm { font-size: 12pt !important; }
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
            const tableRows = descendants.map(({ person, relationship }) => {
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
                    doc.text('Descendant Report', margin, 15);
                    doc.addImage(summaryImgData, 'JPEG', margin, 20, summaryImgWidth, summaryImgHeight);
                },
                didParseCell: (data) => {
                    const person = descendants[data.row.index]?.person;
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
            console.error("Error generating descendant report PDF:", error);
            alert("Sorry, an error occurred while generating the PDF report.");
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    const handleViewOnTree = (personId: string) => {
        if (!descendantReportData) return;
        
        const queue: { personId: string; path: string[] }[] = [{ personId: descendantReportData.rootPerson.id, path: [descendantReportData.rootPerson.id] }];
        const visited = new Set<string>([descendantReportData.rootPerson.id]);
        let finalPath: string[] | null = null;
        
        while(queue.length > 0) {
            const { personId: currentId, path } = queue.shift()!;
            if (currentId === personId) {
                finalPath = path;
                break;
            }
            const currentPerson = getPersonById(currentId);
            currentPerson?.childrenIds?.forEach(childId => {
                if (!visited.has(childId)) {
                    visited.add(childId);
                    queue.push({ personId: childId, path: [...path, childId] });
                }
            })
        }

        if (finalPath) {
             configureTreeView({ rootId: descendantReportData.rootPerson.id, visiblePath: finalPath });
             navigate('/tree');
        } else {
            alert("Could not construct path to person on the tree.");
        }
    };

    return (
        <div className="report-container">
            <h3 className="text-xl font-semibold mb-4">Descendant Report</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Select an individual to generate a list of all their known descendants.
            </p>
            <div className="flex items-end space-x-2 mb-4 no-print">
                <div className="flex-grow max-w-sm">
                    <SearchableSelect
                        label="Select Person"
                        options={people}
                        value={personId}
                        onChange={setPersonId}
                        placeholder="Select an ancestor"
                    />
                </div>
                {descendantReportData && (
                     <Button onClick={handleDownloadDescendantReport} disabled={isGeneratingPdf}>
                         {isGeneratingPdf ? <SpinnerIcon /> : <PrintIcon />}
                         <span className="ml-2 hidden sm:inline">{isGeneratingPdf ? 'Generating...' : 'Download Report'}</span>
                     </Button>
                )}
            </div>

            {descendantReportData && (
                <div className="animate-fadeIn">
                    <div id="summary-card-descendants" className={`p-4 border rounded-lg mb-6 ${
                        descendantReportData.rootPerson.gender === Gender.Male ? 'bg-male dark:bg-male-dark' :
                        descendantReportData.rootPerson.gender === Gender.Female ? 'bg-female dark:bg-female-dark' :
                        'bg-gray-50 dark:bg-gray-800/50'
                    }`}>
                        <h4 className="text-lg font-semibold mb-2">Report for: {getFullName(descendantReportData.rootPerson)}</h4>
                        <div className="flex items-start space-x-4">
                            <div className="flex-shrink-0 w-24 h-32 rounded-md flex items-center justify-center bg-gray-200 dark:bg-gray-700 overflow-hidden">
                                {descendantReportData.rootPerson.photos?.[0] ? <img src={descendantReportData.rootPerson.photos[0]} alt={getFullName(descendantReportData.rootPerson)} className="w-full h-full object-cover" />
                                    : (
                                        <>
                                            {descendantReportData.rootPerson.gender === Gender.Male && <MaleSymbolIcon />}
                                            {descendantReportData.rootPerson.gender === Gender.Female && <FemaleSymbolIcon />}
                                            {descendantReportData.rootPerson.gender !== Gender.Male && descendantReportData.rootPerson.gender !== Gender.Female && <UserIcon />}
                                        </>
                                    )}
                            </div>
                            <div className="text-sm">
                                <p><strong>Born:</strong> {descendantReportData.rootPerson.birthDate || 'N/A'} {descendantReportData.rootPerson.birthPlace && `in ${descendantReportData.rootPerson.birthPlace}`}</p>
                                {descendantReportData.rootPerson.deathDate && <p><strong>Died:</strong> {descendantReportData.rootPerson.deathDate} {descendantReportData.rootPerson.deathPlace && `in ${descendantReportData.rootPerson.deathPlace}`}</p>}
                                <p className="mt-2">Total Descendants Found: {descendantReportData.descendants.length}</p>
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
                                     <th className="p-3 font-semibold text-gray-600 dark:text-gray-300 tracking-wider no-print">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                                {descendantReportData.descendants.map(({person, relationship}) => {
                                    const genderClass = person.gender === Gender.Male ? 'bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100' : person.gender === Gender.Female ? 'bg-pink-50 dark:bg-pink-900/20 hover:bg-pink-100' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50';
                                    
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
                                            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-200 dark:bg-gray-700 overflow-hidden border-2 border-transparent">
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
                                        <td className="p-3 no-print">
                                            <Button size="sm" variant="secondary" onClick={() => handleViewOnTree(person.id)}>View on Tree</Button>
                                        </td>
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

export default DescendantsReport;
