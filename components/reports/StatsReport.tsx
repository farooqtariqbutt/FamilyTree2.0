
import React, { useMemo, useRef, useState } from 'react';
import type { Person, Statistics } from '../../types.ts';
import { useFamilyTreeContext } from '../../hooks/useFamilyTree.ts';
import { getLifespanInMonths, formatLifespan, calculateAge } from '../../utils/dateUtils.ts';
import { getFullName } from '../../utils/personUtils.ts';
import Button from '../ui/Button.tsx';
import { PrintIcon, SpinnerIcon } from '../ui/Icons.tsx';
import { generatePdf } from '../../utils/pdfUtils.ts';


const StatsReport = () => {
    const { people } = useFamilyTreeContext();
    const statsContainerRef = useRef<HTMLDivElement>(null);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    const stats = useMemo<Statistics>(() => {
        const totalPeople = people.length;
        const maleCount = people.filter(p => p.gender === 'Male').length;
        const femaleCount = people.filter(p => p.gender === 'Female').length;
        
        const lifespansInMonths = people
            .map(p => getLifespanInMonths(p.birthDate, p.deathDate))
            .filter((months): months is number => months !== null && months > 0);
        
        const avgLifespanMonths = lifespansInMonths.length > 0 ? lifespansInMonths.reduce((a, b) => a + b, 0) / lifespansInMonths.length : 0;
        const averageLifespan = formatLifespan(avgLifespanMonths);

        let oldestLivingPerson: Person | undefined;
        let oldestPersonEver: Person | undefined;
        
        let maxAgeLiving = -1;
        let maxAgeEver = -1;
        
        people.forEach(p => {
            const ageString = calculateAge(p.birthDate, p.deathDate);
            if(ageString === 'N/A') return;

            const ageInTotalMonths = (parseInt(ageString.split(' ')[0]) * 12) + parseInt(ageString.split(' ')[2]);

            if (p.deathDate) {
                if (ageInTotalMonths > maxAgeEver) {
                    maxAgeEver = ageInTotalMonths;
                    oldestPersonEver = p;
                }
            } else {
                 if (ageInTotalMonths > maxAgeLiving) {
                    maxAgeLiving = ageInTotalMonths;
                    oldestLivingPerson = p;
                }
                if (ageInTotalMonths > maxAgeEver) {
                    maxAgeEver = ageInTotalMonths;
                    oldestPersonEver = p;
                }
            }
        });

        return { totalPeople, maleCount, femaleCount, averageLifespan, oldestLivingPerson, oldestPersonEver };
    }, [people]);

    const handleDownloadReport = async () => {
        if (!statsContainerRef.current) return;
    
        setIsGeneratingPdf(true);
        
        const fileName = 'Family_Statistics_Report';
        
        const printableElement = document.createElement('div');
        printableElement.style.position = 'absolute';
        printableElement.style.left = '-9999px';
        printableElement.style.width = '210mm';
        printableElement.style.padding = '20px';
        printableElement.style.backgroundColor = 'white';
        printableElement.style.color = 'black';
        printableElement.style.fontFamily = 'sans-serif';
    
        const reportTitleHtml = `<h1 style="font-size: 28px; font-weight: bold; text-align: center; margin-bottom: 20px;">Family Statistics Report</h1>`;
        printableElement.innerHTML = reportTitleHtml;
    
        const statsClone = statsContainerRef.current.cloneNode(true) as HTMLElement;
        printableElement.appendChild(statsClone);
    
        document.body.appendChild(printableElement);
    
        try {
            await generatePdf(printableElement, fileName);
        } catch (error) {
            console.error("Error generating stats PDF:", error);
            alert("Sorry, an error occurred while generating the PDF report.");
        } finally {
            if (document.body.contains(printableElement)) {
                document.body.removeChild(printableElement);
            }
            setIsGeneratingPdf(false);
        }
    };
    
    return (
        <div className="report-container">
            <div className="flex justify-between items-start">
                 <h3 className="text-xl font-semibold mb-4">Family Statistics</h3>
                 <Button onClick={handleDownloadReport} disabled={isGeneratingPdf}>
                    {isGeneratingPdf ? <SpinnerIcon /> : <PrintIcon />}
                    <span className="ml-2 hidden sm:inline">{isGeneratingPdf ? 'Generating...' : 'Download Report'}</span>
                 </Button>
            </div>
            
            <div ref={statsContainerRef}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div className="bg-blue-100 dark:bg-blue-900/50 p-4 rounded-lg">
                        <h4 className="font-bold text-blue-800 dark:text-blue-200">Total Individuals</h4>
                        <p className="text-3xl font-bold text-blue-600 dark:text-blue-300">{stats.totalPeople}</p>
                    </div>
                    <div className="bg-indigo-100 dark:bg-indigo-900/50 p-4 rounded-lg">
                        <h4 className="font-bold text-indigo-800 dark:text-indigo-200">Gender Ratio</h4>
                        <p className="text-xl font-semibold text-indigo-600 dark:text-indigo-300">
                            {stats.maleCount} Male / {stats.femaleCount} Female
                        </p>
                    </div>
                    <div className="bg-green-100 dark:bg-green-900/50 p-4 rounded-lg">
                        <h4 className="font-bold text-green-800 dark:text-green-200">Average Lifespan</h4>
                        <p className="text-xl font-semibold text-green-600 dark:text-green-300">{stats.averageLifespan}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg">
                        <h4 className="font-semibold mb-2">Oldest Living Person</h4>
                        {stats.oldestLivingPerson ? (
                            <div className="flex items-center space-x-3">
                                {stats.oldestLivingPerson.photos?.[0] && <img src={stats.oldestLivingPerson.photos[0]} alt="" className="w-12 h-12 rounded-full object-cover" />}
                                <div>
                                    <p className="font-bold">{getFullName(stats.oldestLivingPerson)}</p>
                                    <p className="text-sm">{calculateAge(stats.oldestLivingPerson.birthDate)}</p>
                                </div>
                            </div>
                        ) : <p className="text-sm text-gray-500">N/A</p>}
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg">
                        <h4 className="font-semibold mb-2">Oldest Person Ever (Deceased)</h4>
                        {stats.oldestPersonEver && stats.oldestPersonEver.deathDate ? (
                            <div className="flex items-center space-x-3">
                                {stats.oldestPersonEver.photos?.[0] && <img src={stats.oldestPersonEver.photos[0]} alt="" className="w-12 h-12 rounded-full object-cover" />}
                                <div>
                                    <p className="font-bold">{getFullName(stats.oldestPersonEver)}</p>
                                    <p className="text-sm">{calculateAge(stats.oldestPersonEver.birthDate, stats.oldestPersonEver.deathDate)}</p>
                                </div>
                            </div>
                        ) : <p className="text-sm text-gray-500">N/A</p>}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StatsReport;
