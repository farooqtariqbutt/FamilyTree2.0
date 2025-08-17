
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Person } from '../../types.ts';
import { Gender } from '../../types.ts';
import { useFamilyTreeContext } from '../../hooks/useFamilyTree.ts';
import { findAllRelationships, type Relationship } from '../../utils/relationshipUtils.ts';
import { getFullName } from '../../utils/personUtils.ts';
import Button from '../ui/Button.tsx';
import SearchableSelect from '../ui/SearchableSelect.tsx';
import { PrintIcon, SpinnerIcon, UserIcon } from '../ui/Icons.tsx';
import { generatePdf } from '../../utils/pdfUtils.ts';

const RelationshipReport = () => {
    const { people } = useFamilyTreeContext();
    const navigate = useNavigate();
    const [person1Id, setPerson1Id] = useState('');
    const [person2Id, setPerson2Id] = useState('');
    const [relationships, setRelationships] = useState<Relationship[] | null>(null);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const relationshipReportRef = useRef<HTMLDivElement>(null);

    const handleFindRelationship = useCallback(() => {
        if (!person1Id || !person2Id) {
            return;
        }
        if (person1Id === person2Id) {
            setRelationships([{ type: 'none', description: 'Please select two different people.' }]);
            return;
        }
        const rels = findAllRelationships(person1Id, person2Id, people);
        setRelationships(rels);
    }, [person1Id, person2Id, people]);

    useEffect(() => {
        if (person1Id && person2Id) {
            handleFindRelationship();
        } else {
            setRelationships(null);
        }
    }, [person1Id, person2Id, handleFindRelationship]);
    
    const handleDownloadRelationshipReport = async () => {
        if (!relationshipReportRef.current || !person1 || !person2) return;
        
        setIsGeneratingPdf(true);
        const fileName = `Relationship_Report_${getFullName(person1)}_${getFullName(person2)}`;

        const printableElement = document.createElement('div');
        printableElement.style.position = 'absolute';
        printableElement.style.left = '-9999px';
        printableElement.style.padding = '20px';
        printableElement.style.backgroundColor = 'white';
        printableElement.style.color = 'black';
        printableElement.style.fontFamily = 'sans-serif';
        printableElement.style.width = '210mm';

        const reportTitle = `<h1 style="font-size: 28px; font-weight: bold; text-align: center; margin-bottom: 20px;">Relationship Report</h1>`;
        printableElement.innerHTML = reportTitle;

        const contentClone = relationshipReportRef.current.cloneNode(true) as HTMLElement;
        printableElement.appendChild(contentClone);

        document.body.appendChild(printableElement);

        try {
            await generatePdf(printableElement, fileName, 'p');
        } catch (error) {
            console.error("Error generating relationship PDF:", error);
            alert("Sorry, an error occurred while generating the PDF report.");
        } finally {
            if (document.body.contains(printableElement)) {
                document.body.removeChild(printableElement);
            }
            setIsGeneratingPdf(false);
        }
    };

    const person1 = people.find(p => p.id === person1Id);
    const person2 = people.find(p => p.id === person2Id);

    const PersonCard = ({ person }: { person: Person }) => {
        const genderClass = person.gender === Gender.Male ? 'bg-male dark:bg-male-dark' : person.gender === Gender.Female ? 'bg-female dark:bg-female-dark' : 'bg-gray-100 dark:bg-gray-800';
        return (
            <div className={`flex items-center space-x-3 p-3 rounded-lg ${genderClass}`}>
                {person.photos?.[0] ? 
                    <img src={person.photos[0]} className="w-12 h-16 rounded-md object-cover" alt={getFullName(person)} /> : 
                    <div className="w-12 h-16 rounded-md bg-gray-200 dark:bg-gray-700 flex items-center justify-center"><UserIcon/></div>
                }
                <div>
                    <p className="font-bold">{getFullName(person)}</p>
                    <p className="text-xs text-gray-500">{person.birthDate || 'Unknown'}</p>
                </div>
            </div>
        );
    };
    
    return (
        <div className="report-container">
            <h3 className="text-xl font-semibold mb-4">Relationship Finder</h3>
             <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Select two individuals from your tree to discover how they are related.
            </p>
            <div className="flex items-end space-x-2 mb-4">
                 <div className="flex-grow max-w-sm">
                    <SearchableSelect
                        label="Person 1"
                        options={people}
                        value={person1Id}
                        onChange={setPerson1Id}
                        placeholder="Select first person"
                    />
                </div>
                <div className="flex-grow max-w-sm">
                     <SearchableSelect
                        label="Person 2"
                        options={people}
                        value={person2Id}
                        onChange={setPerson2Id}
                        placeholder="Select second person"
                    />
                </div>
                {relationships && relationships.some(r => r.type !== 'none') && (
                    <Button onClick={handleDownloadRelationshipReport} disabled={isGeneratingPdf} variant="secondary">
                       {isGeneratingPdf ? <SpinnerIcon /> : <PrintIcon />}
                       <span className="ml-2 hidden sm:inline">{isGeneratingPdf ? 'Generating...' : 'Download Report'}</span>
                    </Button>
                )}
            </div>
            
            {relationships && person1 && person2 && (
                <div ref={relationshipReportRef} className="mt-6 p-4 border rounded-lg bg-gray-50 dark:bg-gray-800/50 animate-fadeIn">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <PersonCard person={person1} />
                        <PersonCard person={person2} />
                    </div>

                    <div className="space-y-4">
                        {relationships.map((relationship, index) => (
                            <div key={index} className="p-4 border-2 rounded-lg bg-white dark:bg-gray-900">
                                {relationship.type === 'none' ? (
                                    <p className="text-center text-gray-500 italic">{relationship.description}</p>
                                ) : (
                                    <>
                                        <div className="text-center p-3 mb-3 bg-blue-50 dark:bg-blue-900/50 rounded-lg border border-blue-200 dark:border-blue-800">
                                            <p className="font-semibold text-blue-800 dark:text-blue-200">{getFullName(person2)} is the</p>
                                            <p className="text-xl font-bold text-blue-600 dark:text-blue-300">{relationship.description}</p>
                                            <p className="font-semibold text-blue-800 dark:text-blue-200">of {getFullName(person1)}</p>
                                        </div>

                                        {relationship.type === 'blood' && (
                                            <div className="mt-4 text-sm text-gray-600 dark:text-gray-300">
                                                 <p className="mb-2">The closest common ancestor is <strong>{getFullName(relationship.lca)}</strong>.</p>
                                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div>
                                                        <h5 className="font-semibold">Path from {getFullName(person1)}:</h5>
                                                        <p>{relationship.path1.map(p => getFullName(p)).join(' → ')}</p>
                                                    </div>
                                                    <div>
                                                        <h5 className="font-semibold">Path from {getFullName(person2)}:</h5>
                                                        <p>{relationship.path2.map(p => getFullName(p)).join(' → ')}</p>
                                                    </div>
                                                 </div>
                                            </div>
                                        )}
                                         {relationship.type === 'path' && (
                                            <div className="mt-4 text-sm text-gray-600 dark:text-gray-300">
                                                 <h5 className="font-semibold">Full Relationship Path:</h5>
                                                 <p>{relationship.path.map(p => getFullName(p)).join(' → ')}</p>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default RelationshipReport;
