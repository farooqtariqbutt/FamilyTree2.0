import React, { useState, useMemo, useCallback, useRef, useLayoutEffect } from 'react';
import { useFamilyTreeContext } from '../hooks/useFamilyTree.ts';
import type { Person } from '../types.ts';
import { Gender } from '../types.ts';
import SearchableSelect from './ui/SearchableSelect.tsx';
import { getFullName } from '../utils/personUtils.ts';
import Button from './ui/Button.tsx';
import { PrintIcon, SpinnerIcon, UserIcon, PlusIcon, MinusIcon } from './ui/Icons.tsx';
import { generatePdf } from '../utils/pdfUtils.ts';

interface GenerationNodeData {
    person: Person;
    spouse?: Person;
    children: GenerationNodeData[];
}

const GenerationCard = ({ person }: { person: Person }) => {
    const genderClass = person.gender === Gender.Male
        ? 'border-male-border bg-male dark:bg-male-dark'
        : person.gender === Gender.Female
        ? 'border-female-border bg-female dark:bg-female-dark'
        : 'border-gray-500';

    return (
        <div className={`p-2 rounded-lg shadow-md border ${genderClass} w-52 flex-shrink-0 flex items-center space-x-2`}>
            <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-gray-200 dark:bg-gray-700 overflow-hidden">
                {person.photos?.[0] ? <img src={person.photos[0]} alt={getFullName(person)} className="w-full h-full object-cover" /> : <UserIcon className="w-6 h-6" />}
            </div>
            <div className="text-xs text-left">
                <h4 className="font-bold text-sm whitespace-normal">{getFullName(person)}</h4>
                <p>b. {person.birthDate || '?'}</p>
            </div>
        </div>
    );
};

const GenerationNodeDisplay: React.FC<{ node: GenerationNodeData }> = ({ node }) => {
    return (
        <div className="flex flex-col items-center">
            {/* Couple */}
            <div className="flex items-center space-x-2">
                <GenerationCard person={node.person} />
                {node.spouse && (
                    <>
                        <span className="text-lg font-bold text-gray-500">&amp;</span>
                        <GenerationCard person={node.spouse} />
                    </>
                )}
            </div>

            {/* Children */}
            {node.children.length > 0 && (
                <div className="pt-8 relative flex flex-col items-center">
                    {/* Vertical line down from couple */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 h-8 w-px bg-gray-400 dark:bg-gray-600"></div>

                    {/* Horizontal line across top of children */}
                    <div className="absolute top-8 left-0 right-0 h-px bg-gray-400 dark:bg-gray-600"></div>
                    
                    <div className="flex items-start space-x-4">
                        {node.children.map((childNode, index) => (
                            <div key={childNode.person.id} className="relative pt-8">
                                {/* Vertical line up to horizontal bar */}
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 h-8 w-px bg-gray-400 dark:bg-gray-600"></div>
                                <GenerationNodeDisplay node={childNode} />
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};


const GenerationView = () => {
    const { people, getPersonById } = useFamilyTreeContext();
    const [selectedPersonId, setSelectedPersonId] = useState('');
    const [generationDepth, setGenerationDepth] = useState(Infinity);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const reportContainerRef = useRef<HTMLDivElement>(null);
    const [zoom, setZoom] = useState(1);
    const [contentSize, setContentSize] = useState({ width: 0, height: 0 });

    const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.1, 2));
    const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.1, 0.3));
    const handleResetZoom = () => setZoom(1);
    
    const getChildrenOfCouple = useCallback((person: Person, spouse: Person | undefined, allPeople: Person[]): Person[] => {
        return (person.childrenIds || [])
            .map(id => allPeople.find(p => p.id === id))
            .filter((c): c is Person => !!c)
            .filter(child => {
                const childParents = new Set(child.parentIds || []);
                if (!childParents.has(person.id)) return false;

                if (spouse) {
                    return childParents.has(spouse.id);
                }
                const otherParentId = child.parentIds?.find(pId => pId !== person.id);
                if (otherParentId) {
                    const otherParent = allPeople.find(p => p.id === otherParentId);
                    if (otherParent && person.marriages?.some(m => m.spouseId === otherParentId)) {
                        return false;
                    }
                }
                return true;
            })
            .sort((a, b) => (a.birthDate || '').localeCompare(b.birthDate || ''));
    }, []);

    const chartData = useMemo<GenerationNodeData | null>(() => {
        if (!selectedPersonId) return null;

        const buildGenerationTree = (personId: string, maxDepth: number): GenerationNodeData | null => {
            const rootPerson = getPersonById(personId);
            if (!rootPerson) return null;

            const buildNode = (p: Person, currentDepth: number): GenerationNodeData => {
                const spouse = p.marriages?.[0] ? getPersonById(p.marriages[0].spouseId) : undefined;
                let childrenNodes: GenerationNodeData[] = [];

                if (currentDepth < maxDepth) {
                    const childrenOfCouple = getChildrenOfCouple(p, spouse, people);
                    childrenNodes = childrenOfCouple.map(child => buildNode(child, currentDepth + 1));
                }
                return { person: p, spouse, children: childrenNodes };
            };
            return buildNode(rootPerson, 1);
        };

        return buildGenerationTree(selectedPersonId, generationDepth);
    }, [selectedPersonId, generationDepth, people, getPersonById, getChildrenOfCouple]);
    
    useLayoutEffect(() => {
        if (reportContainerRef.current) {
            const resizeObserver = new ResizeObserver(entries => {
                for (let entry of entries) {
                    setContentSize({
                        width: (entry.target as HTMLElement).offsetWidth,
                        height: (entry.target as HTMLElement).offsetHeight,
                    });
                }
            });
            resizeObserver.observe(reportContainerRef.current);
            return () => resizeObserver.disconnect();
        }
    }, [chartData]); // Re-observe when chartData changes

    const handleDownloadReport = async () => {
        if (!reportContainerRef.current) return;
        const person = getPersonById(selectedPersonId);
        if (!person) return;

        setIsGeneratingPdf(true);
        const fileName = `Generation_Report_for_${getFullName(person)}`;
        
        const printableElement = document.createElement('div');
        printableElement.style.position = 'absolute';
        printableElement.style.left = '-9999px';
        printableElement.style.width = '210mm';
        printableElement.style.padding = '20px';
        printableElement.style.backgroundColor = 'white';
        printableElement.style.color = 'black';
        printableElement.style.fontFamily = 'sans-serif';

        const reportTitle = `<h1 style="font-size: 28px; font-weight: bold; text-align: center; margin-bottom: 20px;">Generation Report for ${getFullName(person)}</h1>`;
        printableElement.innerHTML = reportTitle;

        const contentClone = reportContainerRef.current.cloneNode(true) as HTMLElement;
        printableElement.appendChild(contentClone);
        
        document.body.appendChild(printableElement);

        try {
            await generatePdf(printableElement, fileName, 'p');
        } catch (error) {
            console.error("Error generating generation view PDF:", error);
            alert("Sorry, an error occurred while generating the PDF report.");
        } finally {
            if (document.body.contains(printableElement)) {
                document.body.removeChild(printableElement);
            }
            setIsGeneratingPdf(false);
        }
    };
    
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
    
    const genButtons = [
        { label: '1G', depth: 1 },
        { label: '2G', depth: 2 },
        { label: '3G', depth: 3 },
        { label: 'All', depth: Infinity },
    ];

    return (
        <div className="flex flex-col">
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
                        placeholder="Select a person to start the view"
                    />
                </div>
                {selectedPersonId && (
                    <div className="flex items-center space-x-4">
                         <div className="flex items-center space-x-1 bg-gray-200 dark:bg-gray-700 p-1 rounded-lg">
                            {genButtons.map(({ label, depth }) => (
                                <button
                                    key={label}
                                    onClick={() => setGenerationDepth(depth)}
                                    className={`px-3 py-1 text-sm font-semibold rounded-md ${generationDepth === depth ? 'bg-white dark:bg-gray-900 text-blue-600 shadow' : 'text-gray-600 dark:text-gray-300'}`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                        <Button onClick={handleDownloadReport} disabled={isGeneratingPdf}>
                            {isGeneratingPdf ? <SpinnerIcon /> : <PrintIcon />}
                            <span className="ml-2 hidden sm:inline">{isGeneratingPdf ? 'Generating...' : 'Download Report'}</span>
                        </Button>
                    </div>
                )}
            </div>

            <div className="overflow-auto p-6 bg-gray-50 dark:bg-gray-800/50">
                {chartData ? (
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
                            <div ref={reportContainerRef} className="p-4 inline-block">
                                <GenerationNodeDisplay node={chartData} />
                            </div>
                        </div>
                    </div>
                    
                ) : (
                    <div className="flex items-center justify-center h-full">
                        <div className="text-center p-8">
                            <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200">Please select a person to begin</h3>
                            <p className="mt-2 text-gray-500 dark:text-gray-400">Choose someone from the dropdown to visualize their descendants.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GenerationView;