
import React, { useState, useMemo, useEffect, useRef } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import autoTable from 'jspdf-autotable';
import { useFamilyTreeContext } from '../../hooks/useFamilyTree.ts';
import { getAncestorsHierarchically, getDescendantsWithRelationship, getSiblingsWithRelationship } from '../../utils/reportUtils.ts';
import { calculateAge } from '../../utils/dateUtils.ts';
import { getFullName } from '../../utils/personUtils.ts';
import { Gender, type Person } from '../../types.ts';
import Button from '../ui/Button.tsx';
import SearchableSelect from '../ui/SearchableSelect.tsx';
import { PrintIcon, SpinnerIcon, MaleSymbolIcon, FemaleSymbolIcon, UserIcon } from '../ui/Icons.tsx';

interface LifeEvent {
    date: string;
    age: string;
    event: string;
    type: 'birth' | 'death' | 'marriage';
    details: string;
    relationship: string;
}

const EventsReport = () => {
    const { people, getPersonById } = useFamilyTreeContext();
    const [selectedPersonId, setSelectedPersonId] = useState<string>('');
    const [reportPerson, setReportPerson] = useState<Person | null>(null);
    const eventReportRef = useRef<HTMLDivElement>(null);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    useEffect(() => {
        if (selectedPersonId) {
            const person = people.find(p => p.id === selectedPersonId);
            setReportPerson(person || null);
        } else {
            setReportPerson(null);
        }
    }, [selectedPersonId, people]);

    const lifeEvents = useMemo<LifeEvent[]>(() => {
        if (!reportPerson?.birthDate) return [];

        const personStartDate = new Date(reportPerson.birthDate);
        const personEndDate = reportPerson.deathDate ? new Date(reportPerson.deathDate) : new Date();

        const isWithinLifespan = (eventDateStr: string | undefined): boolean => {
            if (!eventDateStr) return false;
            const eventDate = new Date(eventDateStr);
            return eventDate >= personStartDate && eventDate <= personEndDate;
        };

        const events: LifeEvent[] = [];

        events.push({
            date: reportPerson.birthDate,
            age: '0 years, 0 months',
            event: 'Birth',
            type: 'birth',
            details: `Birth of Self${reportPerson.birthPlace ? ` in ${reportPerson.birthPlace}` : ''}`,
            relationship: 'Self'
        });
        reportPerson.marriages?.forEach(marriage => {
            if (isWithinLifespan(marriage.date)) {
                const spouse = getPersonById(marriage.spouseId);
                events.push({
                    date: marriage.date!,
                    age: calculateAge(reportPerson.birthDate, marriage.date),
                    event: 'Marriage',
                    type: 'marriage',
                    details: `Married ${spouse ? getFullName(spouse) : 'Unknown'}${marriage.place ? ` in ${marriage.place}` : ''}`,
                    relationship: 'Self'
                });
            }
        });
        if (reportPerson.deathDate && isWithinLifespan(reportPerson.deathDate)) {
            events.push({
                date: reportPerson.deathDate,
                age: calculateAge(reportPerson.birthDate, reportPerson.deathDate),
                event: 'Death',
                type: 'death',
                details: `Death of Self${reportPerson.deathPlace ? ` in ${reportPerson.deathPlace}` : ''}`,
                relationship: 'Self'
            });
        }

        const ancestors = getAncestorsHierarchically(reportPerson, people);
        ancestors.forEach(({ person: ancestor, level }) => {
            if (level > 2) return;
            if (isWithinLifespan(ancestor.deathDate)) {
                let relationship = level === 1 
                    ? (ancestor.gender === Gender.Male ? 'Father' : 'Mother') 
                    : (ancestor.gender === Gender.Male ? 'Grandfather' : 'Grandmother');
                events.push({
                    date: ancestor.deathDate!,
                    age: calculateAge(reportPerson.birthDate, ancestor.deathDate),
                    event: 'Death',
                    type: 'death',
                    details: `Death of ${getFullName(ancestor)}`,
                    relationship: relationship
                });
            }
        });

        const siblings = getSiblingsWithRelationship(reportPerson, people);
        siblings.forEach(({ person: sibling, relationship }) => {
            if (isWithinLifespan(sibling.birthDate)) {
                events.push({ date: sibling.birthDate!, age: calculateAge(reportPerson.birthDate, sibling.birthDate), event: 'Birth', type: 'birth', details: `Birth of ${getFullName(sibling)}`, relationship });
            }
            sibling.marriages?.forEach(marriage => {
                if (isWithinLifespan(marriage.date)) {
                    const spouse = getPersonById(marriage.spouseId);
                    events.push({ date: marriage.date!, age: calculateAge(reportPerson.birthDate, marriage.date), event: 'Marriage', type: 'marriage', details: `Marriage of ${getFullName(sibling)} to ${spouse ? getFullName(spouse) : 'Unknown'}`, relationship });
                }
            });
            if (isWithinLifespan(sibling.deathDate)) {
                events.push({ date: sibling.deathDate!, age: calculateAge(reportPerson.birthDate, sibling.deathDate), event: 'Death', type: 'death', details: `Death of ${getFullName(sibling)}`, relationship });
            }
        });
        
        const descendants = getDescendantsWithRelationship(reportPerson, people);
        descendants.forEach(({ person: descendant, relationship }) => {
            if (isWithinLifespan(descendant.birthDate)) {
                events.push({ date: descendant.birthDate!, age: calculateAge(reportPerson.birthDate, descendant.birthDate), event: 'Birth', type: 'birth', details: `Birth of ${getFullName(descendant)}`, relationship });
            }
            descendant.marriages?.forEach(marriage => {
                if (isWithinLifespan(marriage.date)) {
                    const spouse = getPersonById(marriage.spouseId);
                    events.push({ date: marriage.date!, age: calculateAge(reportPerson.birthDate, marriage.date), event: 'Marriage', type: 'marriage', details: `Marriage of ${getFullName(descendant)} to ${spouse ? getFullName(spouse) : 'Unknown'}`, relationship });
                }
            });
            if (isWithinLifespan(descendant.deathDate)) {
                events.push({ date: descendant.deathDate!, age: calculateAge(reportPerson.birthDate, descendant.deathDate), event: 'Death', type: 'death', details: `Death of ${getFullName(descendant)}`, relationship });
            }
        });

        const parents = (reportPerson.parentIds || []).map(id => getPersonById(id)).filter((p): p is Person => !!p);
        parents.forEach(parent => {
            const parentSiblings = getSiblingsWithRelationship(parent, people);
            parentSiblings.forEach(({person: uncleAunt}) => {
                const relationship = uncleAunt.gender === Gender.Male ? 'Uncle' : 'Aunt';
                 uncleAunt.marriages?.forEach(marriage => {
                    if (isWithinLifespan(marriage.date)) {
                        const spouse = getPersonById(marriage.spouseId);
                        events.push({
                            date: marriage.date!,
                            age: calculateAge(reportPerson.birthDate, marriage.date),
                            event: 'Marriage',
                            type: 'marriage',
                            details: `Marriage of ${getFullName(uncleAunt)} to ${spouse ? getFullName(spouse) : 'Unknown'}`,
                            relationship: relationship
                        });
                    }
                });
            });
        });

        return events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [reportPerson, people, getPersonById]);
    
    const handleDownloadEventReport = async () => {
        if (!reportPerson) return;
    
        setIsGeneratingPdf(true);
        const fileName = `Life_Events_for_${getFullName(reportPerson)}`;
        
        const doc = new jsPDF('p', 'mm', 'a4');
        const summaryCardEl = document.getElementById('summary-card');
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
                        body, body * { 
                            color: #1f2937 !important; 
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                        }
                        #summary-card { font-size: 12pt !important; line-height: 1.5 !important; }
                        #summary-card h4 { font-size: 14pt !important; }
                        #summary-card .text-sm { font-size: 12pt !important; }
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

            const tableColumns = ['Age', 'Date', 'Event', 'Details', 'Relationship'];
            const tableRows = lifeEvents.map(event => [event.age, event.date, event.event, event.details, event.relationship]);
            const headerHeight = 15 + summaryImgHeight + 5;

            autoTable(doc, {
                head: [tableColumns],
                body: tableRows,
                startY: headerHeight,
                theme: 'grid',
                headStyles: { fillColor: [59, 130, 246] },
                didDrawPage: (data) => {
                    doc.setFontSize(18);
                    doc.setFont('helvetica', 'bold');
                    doc.text('Timeline of Life Events', margin, 15);
                    doc.addImage(summaryImgData, 'JPEG', margin, 20, summaryImgWidth, summaryImgHeight);
                },
                didParseCell: (data) => {
                    const event = lifeEvents[data.row.index];
                    if (event) {
                        const eventColor = {
                            birth: [209, 250, 229],
                            death: [254, 226, 226],
                            marriage: [254, 249, 195],
                        }[event.type];
                        if (eventColor) {
                            data.cell.styles.fillColor = eventColor as [number, number, number];
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
                doc.text(dateTime, margin, pageHeight - margin + 5);
                const pageNumText = `Page ${i} of ${pageCount}`;
                const textWidth = doc.getStringUnitWidth(pageNumText) * doc.getFontSize() / doc.internal.scaleFactor;
                doc.text(pageNumText, pageWidth - margin - textWidth, pageHeight - margin + 5);
            }
    
            doc.save(`${fileName.replace(/\s/g, '_')}.pdf`);

        } catch (error) {
            console.error("Error generating event report PDF:", error);
            alert("Sorry, an error occurred while generating the PDF report.");
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    return (
        <div className="report-container">
            <h3 className="text-xl font-semibold mb-4">Timeline of Life Events</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Select a person to see a detailed timeline of significant events within their lifespan.
            </p>
            <div className="flex items-end space-x-2 mb-4 no-print">
                <div className="flex-grow max-w-sm">
                    <SearchableSelect
                        label="Select Person"
                        options={people}
                        value={selectedPersonId}
                        onChange={setSelectedPersonId}
                        placeholder="Select a person"
                    />
                </div>
                {reportPerson && (
                    <Button onClick={handleDownloadEventReport} disabled={isGeneratingPdf}>
                        {isGeneratingPdf ? <SpinnerIcon /> : <PrintIcon />}
                        <span className="ml-2 hidden sm:inline">{isGeneratingPdf ? 'Generating...' : 'Download Report'}</span>
                    </Button>
                )}
            </div>

            {reportPerson ? (
                <div ref={eventReportRef}>
                    <div id="summary-card" className={`p-4 border rounded-lg mb-6 ${
                        reportPerson.gender === Gender.Male ? 'bg-male dark:bg-male-dark' :
                        reportPerson.gender === Gender.Female ? 'bg-female dark:bg-female-dark' :
                        'bg-gray-50 dark:bg-gray-800/50'
                    }`}>
                        <div className="flex items-start space-x-4">
                            <div className="flex-shrink-0 w-24 h-32 rounded-md flex items-center justify-center bg-gray-200 dark:bg-gray-700 overflow-hidden">
                                {reportPerson.photos?.[0] ? <img src={reportPerson.photos[0]} alt={getFullName(reportPerson)} className="w-full h-full object-cover" />
                                    : (
                                        <>
                                            {reportPerson.gender === Gender.Male && <MaleSymbolIcon />}
                                            {reportPerson.gender === Gender.Female && <FemaleSymbolIcon />}
                                            {reportPerson.gender !== Gender.Male && reportPerson.gender !== Gender.Female && <UserIcon />}
                                        </>
                                    )}
                            </div>
                            <div className="text-sm">
                                <h4 className="text-lg font-semibold mb-2">{getFullName(reportPerson)}</h4>
                                <p><strong>Born:</strong> {reportPerson.birthDate || 'N/A'}{reportPerson.birthPlace ? ` in ${reportPerson.birthPlace}` : ''}</p>
                                {reportPerson.deathDate && <p><strong>Died:</strong> {reportPerson.deathDate}{reportPerson.deathPlace ? ` in ${reportPerson.deathPlace}` : ''}</p>}
                            </div>
                        </div>
                    </div>
                    {lifeEvents.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-100 dark:bg-gray-800">
                                    <tr>
                                        {['Age', 'Date', 'Event', 'Details', 'Relationship'].map(header =>
                                            <th key={header} className="p-3 font-semibold text-gray-600 dark:text-gray-300 tracking-wider">{header}</th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                                    {lifeEvents.map((event, index) => {
                                        const eventColorClass = {
                                            birth: 'bg-green-100 dark:bg-green-900/50',
                                            death: 'bg-red-100 dark:bg-red-900/50',
                                            marriage: 'bg-yellow-100 dark:bg-yellow-900/50',
                                        }[event.type];
                                        return (
                                        <tr key={index} className={eventColorClass}>
                                            <td className="p-3">{event.age}</td>
                                            <td className="p-3">{event.date}</td>
                                            <td className="p-3 font-semibold">{event.event}</td>
                                            <td className="p-3">{event.details}</td>
                                            <td className="p-3">{event.relationship}</td>
                                        </tr>
                                    )})}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="text-gray-500 mt-4">No significant life events found for {getFullName(reportPerson)} within their lifespan.</p>
                    )}
                </div>
            ) : (
                <p className="text-gray-500">Please select a person to view their life event timeline.</p>
            )}
        </div>
    );
};

export default EventsReport;
