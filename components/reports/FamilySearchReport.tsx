
import React, { useState, useMemo, useEffect } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useFamilyTreeContext } from '../../hooks/useFamilyTree.ts';
import type { Person } from '../../types.ts';
import { Gender } from '../../types.ts';
import { findRelationship } from '../../utils/relationshipUtils.ts';
import { calculateAge } from '../../utils/dateUtils.ts';
import { getFullName } from '../../utils/personUtils.ts';
import SearchableSelect from '../ui/SearchableSelect.tsx';
import Button from '../ui/Button.tsx';
import { PrintIcon, SpinnerIcon, UserIcon, ArrowUpIcon, ArrowDownIcon } from '../ui/Icons.tsx';

interface Relative {
    person: Person;
    relationship: string;
    lineage?: 'paternal' | 'maternal';
}

type SortKey = 'Name' | 'Age' | 'DoB';
type SortDirection = 'asc' | 'desc';

const FamilySearchReport = () => {
    const { people, getPersonById } = useFamilyTreeContext();
    const [selectedPersonId, setSelectedPersonId] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [allRelatives, setAllRelatives] = useState<Relative[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({ key: 'Name', direction: 'asc' });


    useEffect(() => {
        const findRelatives = () => {
            if (!selectedPersonId) {
                setAllRelatives([]);
                return;
            }

            setIsLoading(true);
            
            setTimeout(() => {
                const selectedPerson = getPersonById(selectedPersonId);
                if (!selectedPerson) {
                    setIsLoading(false);
                    return;
                }
                const parents = (selectedPerson.parentIds || []).map(id => getPersonById(id)).filter((p): p is Person => !!p);
                const father = parents.find(p => p.gender === Gender.Male);
                const mother = parents.find(p => p.gender === Gender.Female);
                
                const relatives: Relative[] = [];
                for (const otherPerson of people) {
                    if (otherPerson.id === selectedPersonId) continue;
                    
                    const rel = findRelationship(selectedPersonId, otherPerson.id, people);
                    
                    if (rel && rel.type !== 'none' && rel.description) {
                        let lineage: 'paternal' | 'maternal' | undefined = undefined;
                        
                        if(otherPerson.id === father?.id) {
                            lineage = 'paternal';
                        } else if(otherPerson.id === mother?.id) {
                            lineage = 'maternal';
                        } else if (rel.type === 'blood' && rel.path1.length > 1) {
                            if (rel.path1[1].id === father?.id) lineage = 'paternal';
                            else if (rel.path1[1].id === mother?.id) lineage = 'maternal';
                        } else if (rel.type === 'path' && rel.path.length > 1) {
                            if (rel.path[1].id === father?.id) lineage = 'paternal';
                            else if (rel.path[1].id === mother?.id) lineage = 'maternal';
                        }
                        
                        relatives.push({ person: otherPerson, relationship: rel.description, lineage });
                    }
                }
                
                setAllRelatives(relatives);
                setIsLoading(false);
            }, 50);
        };

        findRelatives();

    }, [selectedPersonId, people, getPersonById]);

    const requestSort = (key: SortKey) => {
        let direction: SortDirection = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key: SortKey) => {
        if (sortConfig.key !== key) return null;
        return sortConfig.direction === 'asc' ? <ArrowUpIcon /> : <ArrowDownIcon />;
    };

    const sortedAndFilteredRelatives = useMemo(() => {
        let sortableItems = [...allRelatives];

        if (searchTerm) {
            sortableItems = sortableItems.filter(rel =>
                rel.relationship.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }
        
        const getAgeInMonths = (p: Person): number => {
            if (!p.birthDate) return -1;
            const start = new Date(p.birthDate);
            const end = p.deathDate ? new Date(p.deathDate) : new Date();
            if (isNaN(start.getTime()) || isNaN(end.getTime())) return -1;
            let years = end.getFullYear() - start.getFullYear();
            let months = end.getMonth() - start.getMonth();
            if (end.getDate() < start.getDate()) months--;
            if (months < 0) {
                years--;
                months += 12;
            }
            return years * 12 + months;
        };

        sortableItems.sort((a, b) => {
            const key = sortConfig.key;
            const direction = sortConfig.direction === 'asc' ? 1 : -1;

            let valA, valB;

            switch (key) {
                case 'Name':
                    valA = getFullName(a.person);
                    valB = getFullName(b.person);
                    break;
                case 'Age':
                    valA = getAgeInMonths(a.person);
                    valB = getAgeInMonths(b.person);
                    break;
                case 'DoB':
                    valA = a.person.birthDate || '';
                    valB = b.person.birthDate || '';
                    break;
                default:
                    return 0;
            }
            
            if (valA === -1 || valA === '') return 1 * direction;
            if (valB === -1 || valB === '') return -1 * direction;

            if (valA < valB) return -1 * direction;
            if (valA > valB) return 1 * direction;
            
            return getFullName(a.person).localeCompare(getFullName(b.person));
        });

        return sortableItems;
    }, [allRelatives, searchTerm, sortConfig]);

    const handleDownloadReport = () => {
        const selectedPerson = people.find(p => p.id === selectedPersonId);
        if (!selectedPerson) return;

        setIsGeneratingPdf(true);
        const fileName = `Family_Search_Report_for_${getFullName(selectedPerson)}`;
        const doc = new jsPDF('p', 'mm', 'a4');
        const pageHeight = doc.internal.pageSize.getHeight();
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 10;
        
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('Family Search Report', margin, 15);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text(`Searching relatives of: ${getFullName(selectedPerson)}`, margin, 22);
        if (searchTerm) {
            doc.text(`Filtering for relationship: "${searchTerm}"`, margin, 28);
        }

        const tableColumns = ['Status', 'Name', 'Relationship', 'DoB', 'Age'];
        const tableRows = sortedAndFilteredRelatives.map(({ person, relationship }) => {
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
                calculateAge(person.birthDate, person.deathDate),
            ];
        });

        autoTable(doc, {
            head: [tableColumns],
            body: tableRows,
            startY: searchTerm ? 34 : 28,
            theme: 'grid',
            headStyles: { fillColor: [59, 130, 246] },
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

        doc.save(`${fileName}.pdf`);
        setIsGeneratingPdf(false);
    };
    
    const selectedPerson = people.find(p => p.id === selectedPersonId);

    return (
        <div className="report-container">
            <h3 className="text-xl font-semibold mb-4">Family Search</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Select a person to view a list of all their relatives, then search for a specific relationship.
            </p>
            <div className="flex items-end space-x-2 mb-4">
                <div className="flex-grow max-w-sm">
                    <SearchableSelect
                        label="Select Person"
                        options={people}
                        value={selectedPersonId}
                        onChange={setSelectedPersonId}
                        placeholder="Select a person"
                    />
                </div>
                {selectedPerson && (
                    <>
                        <div className="flex-grow max-w-sm">
                            <label htmlFor="relationship-search" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Search Relationship
                            </label>
                            <input
                                id="relationship-search"
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="e.g., Son, Cousin, Aunt..."
                                className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            />
                        </div>
                        <Button onClick={handleDownloadReport} disabled={isGeneratingPdf || sortedAndFilteredRelatives.length === 0} variant="secondary">
                            {isGeneratingPdf ? <SpinnerIcon /> : <PrintIcon />}
                            <span className="ml-2 hidden sm:inline">{isGeneratingPdf ? 'Generating...' : 'Download Report'}</span>
                        </Button>
                    </>
                )}
            </div>

            {isLoading && (
                <div className="flex items-center justify-center p-8">
                    <SpinnerIcon />
                    <span className="ml-2">Finding all relatives...</span>
                </div>
            )}
            
            {!isLoading && selectedPerson && (
                 <div className="animate-fadeIn">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        Showing {sortedAndFilteredRelatives.length} of {allRelatives.length} total relatives for <strong>{getFullName(selectedPerson)}</strong>.
                    </p>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                           <thead className="bg-gray-100 dark:bg-gray-800">
                                <tr>
                                    <th className="p-3 font-semibold text-gray-600 dark:text-gray-300 tracking-wider">Photo</th>
                                    <th className="p-3 font-semibold text-gray-600 dark:text-gray-300 tracking-wider text-center">Status</th>
                                    <th className="p-3 font-semibold text-gray-600 dark:text-gray-300 tracking-wider">
                                        <div className="flex items-center space-x-1 cursor-pointer" onClick={() => requestSort('Name')}>
                                            <span>Name</span>
                                            {getSortIcon('Name')}
                                        </div>
                                    </th>
                                    <th className="p-3 font-semibold text-gray-600 dark:text-gray-300 tracking-wider">Relationship</th>
                                    <th className="p-3 font-semibold text-gray-600 dark:text-gray-300 tracking-wider">
                                        <div className="flex items-center space-x-1 cursor-pointer" onClick={() => requestSort('DoB')}>
                                            <span>DoB</span>
                                            {getSortIcon('DoB')}
                                        </div>
                                    </th>
                                    <th className="p-3 font-semibold text-gray-600 dark:text-gray-300 tracking-wider">
                                        <div className="flex items-center space-x-1 cursor-pointer" onClick={() => requestSort('Age')}>
                                            <span>Age</span>
                                            {getSortIcon('Age')}
                                        </div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                                {sortedAndFilteredRelatives.map((relative) => {
                                    const { person, relationship, lineage } = relative;
                                    const genderClass = person.gender === Gender.Male ? 'bg-male dark:bg-male-dark' : person.gender === Gender.Female ? 'bg-female dark:bg-female-dark' : '';
                                    const lineageClass = lineage === 'paternal' ? 'border-blue-500' : lineage === 'maternal' ? 'border-pink-500' : 'border-transparent';

                                    let statusDot;
                                    if (person.deathDate) {
                                        statusDot = <div className="w-3 h-3 bg-red-500 rounded-full mx-auto" title="Deceased"></div>;
                                    } else if (person.birthDate) {
                                        statusDot = <div className="w-3 h-3 bg-green-500 rounded-full mx-auto" title="Alive"></div>;
                                    } else {
                                        statusDot = <div className="w-3 h-3 bg-gray-400 rounded-full mx-auto" title="Unknown Status"></div>;
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
                                        <td className="p-3 align-middle">{statusDot}</td>
                                        <td className="p-3 font-medium">{getFullName(person)}</td>
                                        <td className="p-3 font-semibold">{relationship}</td>
                                        <td className="p-3">{person.birthDate || 'N/A'}</td>
                                        <td className="p-3">{calculateAge(person.birthDate, person.deathDate)}</td>
                                    </tr>
                                )})}
                            </tbody>
                        </table>
                        {sortedAndFilteredRelatives.length === 0 && (
                            <div className="text-center p-8 text-gray-500">
                                No relatives found matching your search term.
                            </div>
                        )}
                    </div>
                 </div>
            )}
            
            {!isLoading && !selectedPerson && (
                <div className="flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-gray-800/50 rounded-lg text-center">
                    <UserIcon className="w-10 h-10 text-gray-400" />
                    <p className="mt-2 text-gray-500">Please select a person to start searching for their relatives.</p>
                </div>
            )}
        </div>
    );
};

export default FamilySearchReport;
