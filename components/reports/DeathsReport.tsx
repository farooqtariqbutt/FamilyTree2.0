
import React, { useMemo, useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useFamilyTreeContext } from '../../hooks/useFamilyTree.ts';
import { calculateAge } from '../../utils/dateUtils.ts';
import { getFullName } from '../../utils/personUtils.ts';
import { Gender } from '../../types.ts';
import Button from '../ui/Button.tsx';
import { GraveIcon, PrintIcon, SpinnerIcon } from '../ui/Icons.tsx';

const DeathsReport = () => {
    const { people } = useFamilyTreeContext();
    const [page, setPage] = useState(0);
    const peoplePerPage = 10;
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    const deceasedPeople = useMemo(() => {
        return people
            .filter(p => p.deathDate)
            .sort((a, b) => new Date(a.deathDate!).getTime() - new Date(b.deathDate!).getTime());
    }, [people]);

    const paginatedPeople = deceasedPeople.slice(page * peoplePerPage, (page + 1) * peoplePerPage);
    const totalPages = Math.ceil(deceasedPeople.length / peoplePerPage);

    const handleDownloadDeathReport = async () => {
        setIsGeneratingPdf(true);
        const fileName = 'Death_Report';
        const doc = new jsPDF('l', 'mm', 'a4');
        const pageHeight = doc.internal.pageSize.getHeight();
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 10;

        try {
            const tableColumns = ['Name', 'Birth Date', 'Death Date', 'Age at Death', 'Place of Death', 'Cause of Death'];
            const tableRows = deceasedPeople.map(person => [
                getFullName(person),
                person.birthDate || 'N/A',
                person.deathDate || 'N/A',
                calculateAge(person.birthDate, person.deathDate),
                person.deathPlace || 'N/A',
                person.causeOfDeath || 'N/A'
            ]);

            doc.setFontSize(18);
            doc.setFont('helvetica', 'bold');
            doc.text('Death Report', margin, 15);
            doc.setFontSize(12);
            doc.setFont('helvetica', 'normal');
            doc.text(`Total Deceased: ${deceasedPeople.length}`, margin, 22);

            autoTable(doc, {
                head: [tableColumns],
                body: tableRows,
                startY: 28,
                theme: 'grid',
                headStyles: { fillColor: [239, 68, 68] },
                didParseCell: (data) => {
                    const person = deceasedPeople[data.row.index];
                    if (person) {
                        if (person.gender === Gender.Male) {
                            data.cell.styles.fillColor = [239, 246, 255];
                        } else if (person.gender === Gender.Female) {
                            data.cell.styles.fillColor = [252, 231, 243];
                        }
                    }
                },
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
            console.error("Error generating death report PDF:", error);
            alert("Sorry, an error occurred while generating the PDF report.");
        } finally {
            setIsGeneratingPdf(false);
        }
    };
    
    return (
        <div className="report-container">
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="text-xl font-semibold mb-2">Death Report</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        A list of all deceased individuals recorded in this family tree.
                    </p>
                </div>
                {deceasedPeople.length > 0 && (
                     <Button onClick={handleDownloadDeathReport} disabled={isGeneratingPdf}>
                         {isGeneratingPdf ? <SpinnerIcon /> : <PrintIcon />}
                         <span className="ml-2 hidden sm:inline">{isGeneratingPdf ? 'Generating...' : 'Download Report'}</span>
                     </Button>
                )}
            </div>
            {deceasedPeople.length > 0 ? (
                <div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-100 dark:bg-gray-800">
                                <tr>
                                    {['Name', 'Birth Date', 'Death Date', 'Age at Death', 'Place of Death', 'Cause of Death'].map(header =>
                                        <th key={header} className="p-3 font-semibold text-gray-600 dark:text-gray-300 tracking-wider">{header}</th>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                                {paginatedPeople.map(person => {
                                    const genderClass = person.gender === Gender.Male ? 'bg-male dark:bg-male-dark' : person.gender === Gender.Female ? 'bg-female dark:bg-female-dark' : '';
                                    return (
                                    <tr key={person.id} className={genderClass}>
                                        <td className="p-3 font-medium">{getFullName(person)}</td>
                                        <td className="p-3">{person.birthDate || 'N/A'}</td>
                                        <td className="p-3">{person.deathDate || 'N/A'}</td>
                                        <td className="p-3">{calculateAge(person.birthDate, person.deathDate)}</td>
                                        <td className="p-3">{person.deathPlace || 'N/A'}</td>
                                        <td className="p-3">{person.causeOfDeath || 'N/A'}</td>
                                    </tr>
                                )})}
                            </tbody>
                        </table>
                    </div>
                    {totalPages > 1 && (
                        <div className="flex justify-between items-center mt-4 text-sm no-print">
                            <Button onClick={() => setPage(p => p - 1)} disabled={page === 0}>Previous</Button>
                            <span>Page {page + 1} of {totalPages}</span>
                            <Button onClick={() => setPage(p => p + 1)} disabled={page === totalPages - 1}>Next</Button>
                        </div>
                    )}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-gray-800/50 rounded-lg text-center">
                    <GraveIcon />
                    <p className="mt-2 text-gray-500">No deaths have been recorded in this family tree.</p>
                </div>
            )}
        </div>
    );
};

export default DeathsReport;
