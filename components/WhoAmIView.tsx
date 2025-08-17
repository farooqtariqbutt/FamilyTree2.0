
import React, { useState, useRef, useLayoutEffect } from 'react';
import { Person, Gender } from '../types.ts';
import { useFamilyTreeContext } from '../hooks/useFamilyTree.ts';
import Button from './ui/Button.tsx';
import { UserIcon, PrintIcon, SpinnerIcon, PlusIcon, MinusIcon } from './ui/Icons.tsx';
import { generatePdf } from '../utils/pdfUtils.ts';
import SearchableSelect from './ui/SearchableSelect.tsx';
import { getFullName } from '../utils/personUtils.ts';
import Tooltip from './ui/Tooltip.tsx';

const PedigreeNode = ({ person, lineage }: { person?: Person; lineage?: 'paternal' | 'maternal' }) => {
    const nameBoxSize = 'w-32';

    if (!person) {
        return (
            <div className="flex flex-col items-center flex-shrink-0 p-2">
                <div className="w-20 h-20 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center border-4 border-dashed border-gray-400 dark:border-gray-600">
                    <UserIcon className="w-10 h-10 text-gray-400" />
                </div>
                <div className={`${nameBoxSize} mt-2 p-1 bg-gray-200 dark:bg-gray-700 rounded text-center text-sm text-gray-500`}>
                    Unknown
                </div>
            </div>
        );
    }

    const dataBoxGenderClass = person.gender === Gender.Male
        ? 'bg-male dark:bg-male-dark border-male-border'
        : person.gender === Gender.Female
        ? 'bg-female dark:bg-female-dark border-female-border'
        : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600';

    const photoOutlineClass = lineage === 'paternal'
        ? 'border-male-border'
        : lineage === 'maternal'
        ? 'border-female-border'
        : 'border-gray-400 dark:border-gray-500';

    return (
        <div className="flex flex-col items-center flex-shrink-0 p-2">
            <div className={`w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center overflow-hidden border-4 shadow-md ${photoOutlineClass}`}>
                {person.photos?.[0] ? (
                    <img src={person.photos[0]} alt={getFullName(person)} className="w-full h-full object-cover" />
                ) : (
                    <UserIcon className="w-10 h-10 text-gray-400 dark:text-gray-500" />
                )}
            </div>
            <div className={`${nameBoxSize} mt-2 p-1 border rounded text-center shadow ${dataBoxGenderClass}`}>
                <p className="font-semibold text-sm whitespace-normal">{getFullName(person)}</p>
                <p className="text-xs text-gray-500">{person.birthDate || 'N/A'}</p>
            </div>
        </div>
    );
};

const PedigreeBranch = ({ person, getPersonById, generation, lineage }: { person?: Person; getPersonById: (id: string) => Person | undefined; generation: number; lineage?: 'paternal' | 'maternal' }) => {
    // Base case for recursion: if we have reached the max depth, we don't render parents.
    // We just render the node for the current person/placeholder.
    if (generation <= 1) {
        return <PedigreeNode person={person} lineage={lineage} />;
    }

    // Determine parents of the current person. If no person, parents are unknown.
    let father: Person | undefined = undefined;
    let mother: Person | undefined = undefined;
    if (person) {
        const parents = (person.parentIds || []).map(id => getPersonById(id)).filter((p): p is Person => !!p);
        father = parents.find(p => p.gender === Gender.Male);
        mother = parents.find(p => p.gender === Gender.Female);
        
        // Handle cases where gender isn't set or is the same, assign remaining parents structurally
        const remainingParents = parents.filter(p => p.id !== father?.id && p.id !== mother?.id);
        if (!father && remainingParents.length > 0) {
            father = remainingParents.shift();
        }
        if (!mother && remainingParents.length > 0) {
            mother = remainingParents.shift();
        }
    }
    
    const fatherLineage = lineage || 'paternal';
    const motherLineage = lineage || 'maternal';

    return (
        <div className="inline-flex flex-col items-center">
            {/* Parent branches - ALWAYS RENDER a branch if not at max depth */}
            <div className="flex items-start">
                <PedigreeBranch person={father} getPersonById={getPersonById} generation={generation - 1} lineage={fatherLineage} />
                <div className="w-8 md:w-16"></div>
                <PedigreeBranch person={mother} getPersonById={getPersonById} generation={generation - 1} lineage={motherLineage} />
            </div>
            
            {/* Connecting lines container */}
            <div className="relative w-full h-8">
                {/* We only draw lines if there is a person below to connect to */}
                {person && (
                    <>
                        {/* Vertical line from Father to midpoint */}
                        {father && <div className="absolute top-0 left-1/4 w-px h-1/2 bg-gray-400 dark:bg-gray-500"></div>}
                        {/* Vertical line from Mother to midpoint */}
                        {mother && <div className="absolute top-0 right-1/4 w-px h-1/2 bg-gray-400 dark:bg-gray-500"></div>}
                        {/* Horizontal line at midpoint, only if there's at least one parent to connect to */}
                        {(father || mother) && <div className="absolute top-1/2 left-1/4 w-1/2 h-px bg-gray-400 dark:bg-gray-500"></div>}
                        {/* Vertical line from midpoint down to the child (current person) */}
                        {(father || mother) && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 w-px h-1/2 bg-gray-400 dark:bg-gray-500"></div>}
                    </>
                )}
            </div>

            {/* Self Node - always render to show the current person or a placeholder */}
            <PedigreeNode person={person} lineage={lineage} />
        </div>
    );
};


const WhoAmIView = () => {
    const { people, getPersonById } = useFamilyTreeContext();
    const [selectedPersonId, setSelectedPersonId] = useState('');
    const pedigreeReportRef = useRef<HTMLDivElement>(null);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [generations, setGenerations] = useState(2);
    const [zoom, setZoom] = useState(1);
    const [contentSize, setContentSize] = useState({ width: 0, height: 0 });

    useLayoutEffect(() => {
        if (pedigreeReportRef.current) {
            const resizeObserver = new ResizeObserver(entries => {
                for (let entry of entries) {
                    setContentSize({
                        width: (entry.target as HTMLElement).offsetWidth,
                        height: (entry.target as HTMLElement).offsetHeight,
                    });
                }
            });
            resizeObserver.observe(pedigreeReportRef.current);
            return () => resizeObserver.disconnect();
        }
    }, [selectedPersonId, generations]); // Re-observe when content might change

    const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.1, 2));
    const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.1, 0.3));
    const handleResetZoom = () => setZoom(1);

    const handleDownloadReport = async () => {
        if (!pedigreeReportRef.current || !me) return;
        
        setIsGeneratingPdf(true);
        const fileName = `Who_Am_I_Report_for_${getFullName(me)}`;
        
        const printableElement = document.createElement('div');
        printableElement.style.position = 'absolute';
        printableElement.style.left = '-9999px';
        printableElement.style.width = '297mm';
        printableElement.style.padding = '20px';
        printableElement.style.backgroundColor = 'white';
        printableElement.style.color = 'black';
        printableElement.style.fontFamily = 'sans-serif';

        const reportTitle = `<h1 style="font-size: 28px; font-weight: bold; text-align: center; margin-bottom: 20px;">Who Am I - Pedigree Chart for ${getFullName(me)}</h1>`;
        printableElement.innerHTML = reportTitle;

        const contentClone = pedigreeReportRef.current.cloneNode(true) as HTMLElement;
        printableElement.appendChild(contentClone);
        
        document.body.appendChild(printableElement);

        try {
            await generatePdf(printableElement, fileName, 'l');
        } catch (error) {
            console.error("Error generating Who Am I report PDF:", error);
            alert("Sorry, an error occurred while generating the PDF report.");
        } finally {
            if (document.body.contains(printableElement)) {
                document.body.removeChild(printableElement);
            }
            setIsGeneratingPdf(false);
        }
    };
    
    const me = selectedPersonId ? getPersonById(selectedPersonId) : undefined;
    
    if (people.length === 0) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center p-8">
                    <h3 className="text-xl font-semibold">Your Family Tree is Empty</h3>
                    <p className="mt-2 text-gray-600 dark:text-gray-400">
                        Start by adding a person from the "All Individuals" page.
                    </p>
                    <div className="mt-4 inline-block">
                        <UserIcon className="w-10 h-10 text-gray-400" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col relative">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-wrap justify-center items-center no-print flex-shrink-0 gap-4">
                 {selectedPersonId && (
                    <div className="flex items-center space-x-1">
                        <Button size="sm" variant="secondary" onClick={handleZoomOut} aria-label="Zoom out"><MinusIcon /></Button>
                        <Button size="sm" variant="secondary" onClick={handleResetZoom} className="w-10">1x</Button>
                        <Button size="sm" variant="secondary" onClick={handleZoomIn} aria-label="Zoom in"><PlusIcon /></Button>
                    </div>
                 )}
                 <div className="flex-grow sm:flex-grow-0 max-w-md w-full sm:w-80">
                    <SearchableSelect
                        options={people}
                        value={selectedPersonId}
                        onChange={setSelectedPersonId}
                        placeholder="Select a person to view pedigree"
                    />
                 </div>
                 {selectedPersonId && (
                    <div className="flex items-center space-x-4">
                         <div className="flex items-center space-x-1">
                            <Button size="sm" variant="secondary" onClick={() => setGenerations(g => Math.max(1, g - 1))}><MinusIcon /></Button>
                            <span className="text-sm font-semibold w-28 text-center">
                                {generations === 1 && "Self"}
                                {generations === 2 && "Parents"}
                                {generations === 3 && "Grandparents"}
                                {generations === 4 && "Great-Grand.."}
                            </span>
                            <Button size="sm" variant="secondary" onClick={() => setGenerations(g => Math.min(4, g + 1))}><PlusIcon /></Button>
                         </div>
                        <Button onClick={handleDownloadReport} disabled={isGeneratingPdf}>
                            {isGeneratingPdf ? <SpinnerIcon /> : <PrintIcon />}
                            <span className="ml-2 hidden sm:inline">{isGeneratingPdf ? 'Generating...' : 'Download Report'}</span>
                        </Button>
                    </div>
                )}
            </div>
            
            <div className="overflow-auto p-6 bg-gray-50 dark:bg-gray-800/50">
                {!me && (
                    <div className="flex items-center justify-center h-full">
                        <div className="text-center p-8">
                            <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200">Please select a person to begin</h3>
                            <p className="mt-2 text-gray-500 dark:text-gray-400">
                                Choose someone from the dropdown above to view their pedigree chart.
                            </p>
                       </div>
                    </div>
                )}
                {me && (
                    <div style={{
                        width: contentSize.width * zoom,
                        height: contentSize.height * zoom,
                        transition: 'width 0.2s ease-out, height 0.2s ease-out',
                    }}>
                        <div
                            style={{
                                transform: `scale(${zoom})`,
                                transformOrigin: 'top left',
                                transition: 'transform 0.2s ease-out',
                            }}
                        >
                            <div ref={pedigreeReportRef} className="p-4 inline-block">
                                <PedigreeBranch person={me} getPersonById={getPersonById} generation={generations} />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WhoAmIView;
