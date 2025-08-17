
import React, { useMemo, useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import type { Person } from '../types.ts';
import { Gender } from '../types.ts';
import { useFamilyTreeContext } from '../hooks/useFamilyTree.ts';
import { MaleSymbolIcon, FemaleSymbolIcon, UserIcon, PlusIcon, MinusIcon, PrintIcon, SpinnerIcon, ArrowUpIcon, ArrowDownIcon, ChevronLeftIcon, ChevronRightIcon, PencilIcon, LinkIcon } from './ui/Icons.tsx';
import Button from './ui/Button.tsx';
import Tooltip from './ui/Tooltip.tsx';
import { generatePdf } from '../utils/pdfUtils.ts';
import SearchableSelect from './ui/SearchableSelect.tsx';
import { getFullName } from '../utils/personUtils.ts';
import { getAllBloodRelativesIds, findRelationship, findAllRelationships, type Relationship } from '../utils/relationshipUtils.ts';
import RelationshipPathModal from './RelationshipPathModal.tsx';

// Helper function to get siblings
const getSiblings = (person: Person, allPeople: Person[]): Person[] => {
    if (!person.parentIds || person.parentIds.length === 0) {
        return [];
    }
    const parentIdSet = new Set(person.parentIds.filter(id => id));
    if (parentIdSet.size === 0) return [];

    return allPeople.filter(p => {
        if (p.id === person.id) return false;
        if (!p.parentIds) return false;
        return p.parentIds.some(pid => parentIdSet.has(pid));
    }).sort((a, b) => {
        const dateA = a.birthDate ? new Date(a.birthDate).getTime() : Infinity;
        const dateB = b.birthDate ? new Date(b.birthDate).getTime() : Infinity;
        if (dateA === Infinity && dateB === Infinity) return 0;
        return dateA - dateB;
    });
};

const NodeCard: React.FC<{
  person: Person;
  isSpouse?: boolean;
  onEdit: (p: Person) => void;
  onToggleAncestors: (p: Person) => void;
  onNavigateToFamily: (p: Person) => void;
  onToggleChildren: () => void;
  onToggleSiblings: (p: Person) => void;
  onShowRelationshipPath: (p: Person) => void;
  childrenVisible: boolean;
  siblingsVisible: boolean;
  ancestorsVisible: boolean;
  hasChildrenToShow: boolean;
  isChildCard?: boolean;
  isSiblingCard?: boolean;
  isFocalChild?: boolean;
  bloodRelativesIds: Set<string>;
  relationshipDescription: string | null;
}> = React.memo(({ person, isSpouse = false, onEdit, onToggleAncestors, onNavigateToFamily, onToggleChildren, onToggleSiblings, onShowRelationshipPath, childrenVisible, siblingsVisible, ancestorsVisible, hasChildrenToShow, isChildCard = false, isSiblingCard = false, isFocalChild = false, bloodRelativesIds, relationshipDescription }) => {
    const genderClass = person.gender === Gender.Male
        ? 'border-male-border bg-male dark:bg-male-dark'
        : person.gender === Gender.Female
        ? 'border-female-border bg-female dark:bg-female-dark'
        : 'border-gray-500';

    const hasParents = person.parentIds?.some(id => !!id);
    const { people } = useFamilyTreeContext();
    const hasSiblings = getSiblings(person, people).length > 0;

    const buttonBaseClass = "bg-gray-100 dark:bg-gray-700 rounded-full p-1 shadow-lg hover:bg-gray-200 dark:hover:bg-gray-600 hover:scale-110 transition-transform";
    
    const hasMultipleRels = useMemo(() => {
        if (!bloodRelativesIds.size) return false;
        const isBloodRelative = bloodRelativesIds.has(person.id);
        if (!isBloodRelative) return false;
        // A person has multiple relationships if they are a blood relative AND are married to another blood relative.
        const isMarriedToBloodRelative = person.marriages?.some(m => bloodRelativesIds.has(m.spouseId));
        return isMarriedToBloodRelative;
    }, [person, bloodRelativesIds]);

    return (
        <div id={`person-card-${person.id}`} className="relative mt-2 mx-2">
            <div
                className={`p-3 rounded-lg shadow-md border-2 ${genderClass} w-64 flex-shrink-0 flex space-x-3 items-start`}
            >
                <div className="flex-shrink-0 w-20 h-24 rounded-md flex items-center justify-center bg-gray-200 dark:bg-gray-700 overflow-hidden">
                    {person.photos?.[0] ? <img src={person.photos[0]} alt={`${person.firstName}`} className="w-full h-full object-cover" />
                        : (
                            <>
                                {person.gender === Gender.Male && <MaleSymbolIcon />}
                                {person.gender === Gender.Female && <FemaleSymbolIcon />}
                                {person.gender !== Gender.Male && person.gender !== Gender.Female && <UserIcon className="w-12 h-12 text-gray-400 dark:text-gray-500" />}
                            </>
                        )}
                </div>
                <div className="flex-grow text-left text-xs">
                    <h3 className="font-bold text-sm leading-tight whitespace-normal">{getFullName(person)}</h3>
                    <div className="mt-1 space-y-1 text-gray-700 dark:text-gray-300">
                        <div><span className="font-semibold">Born:</span> {person.birthDate || 'Unknown'}</div>
                        {person.deathDate && <div><span className="font-semibold">Died:</span> {person.deathDate}</div>}
                    </div>
                     {relationshipDescription && <div className="mt-2 pt-1 border-t border-gray-300 dark:border-gray-600/50 text-gray-600 dark:text-gray-400 font-semibold italic text-[11px]">{relationshipDescription}</div>}
                </div>
            </div>

            {hasMultipleRels && (
                <div className="absolute -top-2 -left-2 z-20">
                    <Tooltip text="Show relationship path">
                        <button onClick={() => onShowRelationshipPath(person)} className={`${buttonBaseClass} text-indigo-500`}>
                            <LinkIcon />
                        </button>
                    </Tooltip>
                </div>
            )}

            <div className="absolute -top-2 -right-2 z-20">
                <Tooltip text="Edit Person">
                    <button onClick={() => onEdit(person)} className={buttonBaseClass}>
                        <PencilIcon />
                    </button>
                </Tooltip>
            </div>
            {hasParents && !isSpouse && !isChildCard && !isSiblingCard && (
                 <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                     <Tooltip text={ancestorsVisible ? "Hide Ancestors" : "Show Ancestors"}>
                        <button onClick={() => onToggleAncestors(person)} className={buttonBaseClass}>
                            {ancestorsVisible ? <MinusIcon /> : <ArrowUpIcon />}
                        </button>
                     </Tooltip>
                 </div>
            )}
            {isFocalChild && (
                 <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                     <Tooltip text="Hide Ancestors">
                        <button onClick={() => onToggleAncestors(person)} className={buttonBaseClass}>
                            <MinusIcon />
                        </button>
                     </Tooltip>
                 </div>
            )}
            {hasChildrenToShow && !isSpouse && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 z-10">
                    <Tooltip text={childrenVisible ? "Hide Children" : "Show Children"}>
                        <button onClick={onToggleChildren} className={buttonBaseClass}>
                            {childrenVisible ? <MinusIcon /> : <ArrowDownIcon />}
                        </button>
                    </Tooltip>
                </div>
            )}
            {hasSiblings && !isSpouse && !isChildCard && !isSiblingCard && (
                 <div className="absolute top-1/2 left-0 -translate-y-1/2 -translate-x-1/2 z-10">
                     <Tooltip text={siblingsVisible ? "Hide Siblings" : "Show Siblings"}>
                        <button onClick={() => onToggleSiblings(person)} className={buttonBaseClass}>
                            {siblingsVisible ? <MinusIcon /> : <ChevronLeftIcon />}
                        </button>
                     </Tooltip>
                 </div>
            )}
            {isSpouse && (
                 <div className="absolute top-1/2 right-0 -translate-y-1/2 translate-x-1/2 z-10">
                     <Tooltip text="Focus on This Person's Family">
                        <button onClick={() => onNavigateToFamily(person)} className={buttonBaseClass}>
                            <ChevronRightIcon />
                        </button>
                     </Tooltip>
                 </div>
            )}
        </div>
    );
});

interface FamilyNodeProps {
    personId: string;
    onEdit: (p: Person) => void;
    onToggleAncestors: (p: Person) => void;
    onNavigateToFamily: (p: Person) => void;
    onToggleChildren: (p: Person) => void;
    onSwitchSpouse: (personId: string, direction: 'next' | 'prev') => void;
    onToggleSiblings: (p: Person) => void;
    onShowRelationshipPath: (p: Person) => void;
    onAddChild: (parent1Id: string, parent2Id: string) => void;
    processedIds: Set<string>;
    allPeople: Person[];
    siblingsVisibleFor: string | null;
    childrenVisibleFor: Set<string>;
    ancestorsVisibleFor: Set<string>;
    activeSpouseIndices: Map<string, number>;
    isChildCard?: boolean;
    isFocalChildNode?: boolean;
    bloodRelativesIds: Set<string>;
    relationshipDescriptions: Map<string, string>;
}

const FamilyNode: React.FC<FamilyNodeProps> = React.memo(({
    personId, onEdit, onToggleAncestors, onNavigateToFamily, onToggleChildren, onSwitchSpouse, onToggleSiblings, onShowRelationshipPath, onAddChild,
    processedIds, allPeople, siblingsVisibleFor, childrenVisibleFor, ancestorsVisibleFor, activeSpouseIndices, isChildCard = false, isFocalChildNode = false, bloodRelativesIds, relationshipDescriptions
}) => {
    const { getPersonById } = useFamilyTreeContext();
    const person = getPersonById(personId);

    if (!person || processedIds.has(personId)) return null;

    const primaryPerson = person;
    const activeSpouseIndex = activeSpouseIndices.get(primaryPerson.id) || 0;
    const currentMarriage = primaryPerson.marriages?.[activeSpouseIndex];
    const spouse = currentMarriage ? getPersonById(currentMarriage.spouseId) : undefined;
    
    const shouldShowSiblings = siblingsVisibleFor === person.id;
    const siblings = shouldShowSiblings ? getSiblings(person, allPeople) : [];

    const displayableChildren = (primaryPerson.childrenIds || [])
        ?.map(id => getPersonById(id))
        .filter((c): c is Person => !!c)
        .filter(child => {
            const childParents = new Set(child.parentIds || []);
            if (!childParents.has(primaryPerson.id)) {
                return false;
            }
            if (spouse) {
                return childParents.has(spouse.id);
            }
            const otherParentId = child.parentIds?.find(pId => pId !== primaryPerson.id);
            if(otherParentId) {
                const otherParent = getPersonById(otherParentId);
                if (otherParent && primaryPerson.marriages?.some(m => m.spouseId === otherParentId)) {
                    return false;
                }
            }
            return true;
        })
        .sort((a, b) => (a.birthDate || '').localeCompare(b.birthDate || '')) || [];
    
    const hasChildrenToShow = displayableChildren.length > 0;
    const areChildrenExplicitlyToggled = childrenVisibleFor.has(primaryPerson.id);
    
    const navigatedUpFromChild = displayableChildren.find(child => ancestorsVisibleFor.has(child.id));

    const childrenToRender = areChildrenExplicitlyToggled
        ? displayableChildren
        : (navigatedUpFromChild ? [navigatedUpFromChild] : []);

    const areAncestorsVisible = ancestorsVisibleFor.has(person.id);
    const parentId = person.parentIds?.find(id => !!id);
    const parent = parentId ? getPersonById(parentId) : undefined;

    const newProcessedIds = new Set(processedIds);
    newProcessedIds.add(primaryPerson.id);
    if (spouse) {
        newProcessedIds.add(spouse.id);
    }

    const coupleWrapperClasses = spouse ? "p-4 border-2 border-dashed border-gray-400 dark:border-gray-600 rounded-xl" : "";

    return (
        <div className="flex flex-col items-center">
            {/* Ancestor branch */}
            {areAncestorsVisible && parent && (
                <div className="flex flex-col items-center">
                    <FamilyNode
                        personId={parent.id}
                        allPeople={allPeople}
                        onEdit={onEdit}
                        onToggleAncestors={onToggleAncestors}
                        onNavigateToFamily={onNavigateToFamily}
                        onToggleChildren={onToggleChildren}
                        onSwitchSpouse={onSwitchSpouse}
                        onToggleSiblings={onToggleSiblings}
                        onShowRelationshipPath={onShowRelationshipPath}
                        onAddChild={onAddChild}
                        processedIds={newProcessedIds}
                        siblingsVisibleFor={siblingsVisibleFor}
                        childrenVisibleFor={childrenVisibleFor}
                        ancestorsVisibleFor={ancestorsVisibleFor}
                        activeSpouseIndices={activeSpouseIndices}
                        isChildCard={false}
                        bloodRelativesIds={bloodRelativesIds}
                        relationshipDescriptions={relationshipDescriptions}
                    />
                    <div className="h-10 w-px bg-gray-400 dark:bg-gray-600"></div>
                </div>
            )}

            <div className="flex items-start">
                 {/* Siblings group */}
                {shouldShowSiblings && siblings.length > 0 && (
                     <div className="flex items-center pr-4">
                        <div className="flex flex-row-reverse space-x-4 space-x-reverse p-4 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl">
                            {siblings.map(sib => (
                                <NodeCard
                                    key={sib.id}
                                    person={sib}
                                    onEdit={onEdit}
                                    onToggleAncestors={onToggleAncestors}
                                    onNavigateToFamily={onNavigateToFamily}
                                    onToggleChildren={() => onToggleChildren(sib)}
                                    onToggleSiblings={onToggleSiblings}
                                    onShowRelationshipPath={onShowRelationshipPath}
                                    childrenVisible={childrenVisibleFor.has(sib.id)}
                                    siblingsVisible={siblingsVisibleFor === sib.id}
                                    ancestorsVisible={ancestorsVisibleFor.has(sib.id)}
                                    hasChildrenToShow={!!sib.childrenIds?.length}
                                    isChildCard={isChildCard}
                                    isSiblingCard={true}
                                    bloodRelativesIds={bloodRelativesIds}
                                    relationshipDescription={relationshipDescriptions.get(sib.id) || null}
                                />
                            ))}
                        </div>
                         <div className="w-8 h-px bg-gray-400 dark:bg-gray-600"></div>
                     </div>
                )}

                <div className="flex flex-col items-center">
                    <div className={`${coupleWrapperClasses} relative`}>
                        <div className="flex items-center justify-center">
                            <NodeCard
                                person={primaryPerson}
                                onEdit={onEdit}
                                onToggleAncestors={onToggleAncestors}
                                onNavigateToFamily={onNavigateToFamily}
                                onToggleChildren={() => onToggleChildren(primaryPerson)}
                                onToggleSiblings={onToggleSiblings}
                                onShowRelationshipPath={onShowRelationshipPath}
                                childrenVisible={areChildrenExplicitlyToggled}
                                siblingsVisible={shouldShowSiblings}
                                ancestorsVisible={areAncestorsVisible}
                                hasChildrenToShow={hasChildrenToShow}
                                isChildCard={isChildCard}
                                isFocalChild={isFocalChildNode}
                                bloodRelativesIds={bloodRelativesIds}
                                relationshipDescription={relationshipDescriptions.get(primaryPerson.id) || null}
                            />
                            {spouse && (
                                <>
                                    <div className="flex items-center justify-center flex-col w-28 text-center px-2">
                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                            <div>{currentMarriage?.status || 'Married'}</div>
                                            <div>{currentMarriage?.date || ''}</div>
                                        </div>
                                        {primaryPerson.marriages && primaryPerson.marriages.length > 1 && (
                                            <div className="flex items-center space-x-2 mt-1">
                                                <Tooltip text="Previous Spouse">
                                                    <button onClick={() => onSwitchSpouse(primaryPerson.id, 'prev')} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><ChevronLeftIcon /></button>
                                                </Tooltip>
                                                <span className="text-xs font-mono">
                                                    {activeSpouseIndex + 1}/{primaryPerson.marriages.length}
                                                </span>
                                                <Tooltip text="Next Spouse">
                                                    <button onClick={() => onSwitchSpouse(primaryPerson.id, 'next')} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><ChevronRightIcon /></button>
                                                </Tooltip>
                                            </div>
                                        )}
                                    </div>
                                    <NodeCard
                                        person={spouse}
                                        isSpouse={true}
                                        onEdit={onEdit}
                                        onToggleAncestors={onToggleAncestors}
                                        onNavigateToFamily={onNavigateToFamily}
                                        onToggleChildren={() => onToggleChildren(spouse)}
                                        onToggleSiblings={onToggleSiblings}
                                        onShowRelationshipPath={onShowRelationshipPath}
                                        childrenVisible={childrenVisibleFor.has(spouse.id)}
                                        siblingsVisible={siblingsVisibleFor === spouse.id}
                                        ancestorsVisible={ancestorsVisibleFor.has(spouse.id)}
                                        hasChildrenToShow={false}
                                        isChildCard={isChildCard}
                                        bloodRelativesIds={bloodRelativesIds}
                                        relationshipDescription={relationshipDescriptions.get(spouse.id) || null}
                                    />
                                </>
                            )}
                        </div>
                        {spouse && (
                            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 z-20">
                                <Tooltip text="Add Child to This Couple">
                                    <button
                                        onClick={() => onAddChild(primaryPerson.id, spouse.id)}
                                        className="bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-200 rounded-full p-1 shadow-lg border border-green-300 dark:border-green-600 hover:bg-green-200 dark:hover:bg-green-700 hover:scale-110 transition-transform"
                                    >
                                        <PlusIcon />
                                    </button>
                                </Tooltip>
                            </div>
                        )}
                    </div>
                    {/* Children Row with connecting lines */}
                    {childrenToRender.length > 0 && (
                        <div className="pt-10 relative">
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 h-5 w-px bg-gray-400 dark:bg-gray-600"></div>
                            
                            <div className="flex justify-center">
                                <div className="flex flex-row items-start">
                                    {childrenToRender.map((child, index) => (
                                        <div key={child.id} className="relative flex flex-col items-center px-4">
                                            <div className="absolute bottom-full left-0 right-0 h-10">
                                                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-5 w-px bg-gray-400 dark:bg-gray-600"></div>
                                                 {childrenToRender.length > 1 && (
                                                    <div className={`absolute bottom-5 h-px bg-gray-400 dark:bg-gray-600 ${
                                                        index === 0 ? 'left-1/2 w-1/2' : index === childrenToRender.length - 1 ? 'right-1/2 w-1/2' : 'w-full'
                                                    }`}></div>
                                                )}
                                            </div>
                                            <FamilyNode
                                                personId={child.id}
                                                allPeople={allPeople}
                                                onEdit={onEdit}
                                                onToggleAncestors={onToggleAncestors}
                                                onNavigateToFamily={onNavigateToFamily}
                                                onToggleChildren={onToggleChildren}
                                                onSwitchSpouse={onSwitchSpouse}
                                                onToggleSiblings={onToggleSiblings}
                                                onShowRelationshipPath={onShowRelationshipPath}
                                                onAddChild={onAddChild}
                                                processedIds={newProcessedIds}
                                                siblingsVisibleFor={siblingsVisibleFor}
                                                childrenVisibleFor={childrenVisibleFor}
                                                ancestorsVisibleFor={ancestorsVisibleFor}
                                                activeSpouseIndices={activeSpouseIndices}
                                                isChildCard={true}
                                                isFocalChildNode={navigatedUpFromChild?.id === child.id}
                                                bloodRelativesIds={bloodRelativesIds}
                                                relationshipDescriptions={relationshipDescriptions}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
});

export const FamilyTreeView: React.FC<{ openPersonForm: (p?: Person, template?: Partial<Person>) => void; }> = ({ openPersonForm }) => {
    const { people, getPersonById, treeViewConfig, configureTreeView } = useFamilyTreeContext();
    const treeContainerRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [zoom, setZoom] = useState(1);
    const [contentSize, setContentSize] = useState({ width: 0, height: 0 });

    const [focusedPersonId, setFocusedPersonId] = useState<string | null>(null);
    const [childrenVisibleFor, setChildrenVisibleFor] = useState<Set<string>>(new Set());
    const [siblingsVisibleFor, setSiblingsVisibleFor] = useState<string | null>(null);
    const [ancestorsVisibleFor, setAncestorsVisibleFor] = useState<Set<string>>(new Set());
    const [activeSpouseIndices, setActiveSpouseIndices] = useState<Map<string, number>>(new Map());
    const [relationshipModalData, setRelationshipModalData] = useState<{ person1: Person, person2: Person, relationships: Relationship[] } | null>(null);

    const bloodRelativesIds = useMemo(() => {
        if (!focusedPersonId) return new Set<string>();
        const focalPerson = getPersonById(focusedPersonId);
        if (!focalPerson) return new Set<string>();
        return getAllBloodRelativesIds(focalPerson, people);
    }, [focusedPersonId, getPersonById, people]);
    
    const relationshipDescriptions = useMemo(() => {
        const descriptions = new Map<string, string>();
        if (!focusedPersonId) return descriptions;

        const focalPerson = getPersonById(focusedPersonId);
        if (!focalPerson) return descriptions;

        people.forEach(person => {
            if (person.id === focusedPersonId) {
                descriptions.set(person.id, 'Focal Person');
            } else {
                const rel = findRelationship(focusedPersonId, person.id, people);
                if (rel && rel.type !== 'none') {
                    let simpleDesc = rel.description;

                    // For complex paths that generate a full sentence, fallback to a generic "Related"
                    if (simpleDesc.includes(' is the ')) {
                       simpleDesc = 'Related';
                    }
                    
                    descriptions.set(person.id, simpleDesc.charAt(0).toUpperCase() + simpleDesc.slice(1));
                }
            }
        });
        return descriptions;
    }, [focusedPersonId, people, getPersonById]);

    const renderRootId = useMemo(() => {
        if (!focusedPersonId) return null;
        const focusedPerson = getPersonById(focusedPersonId);
        if (!focusedPerson) return null;

        let renderRootPerson = focusedPerson;

        const isAncestorPathVisible = ancestorsVisibleFor.has(focusedPerson.id);
        if (isAncestorPathVisible && focusedPerson.parentIds) {
            const parent = focusedPerson.parentIds.map(id => getPersonById(id)).find(p => p);
            if (parent && childrenVisibleFor.has(parent.id)) {
                renderRootPerson = parent;
            }
        }
        
        let finalRoot = renderRootPerson;
        let current = renderRootPerson;
        while(ancestorsVisibleFor.has(current.id) && current.parentIds) {
            const parent = current.parentIds.map(id => getPersonById(id)).find(p => p);
            if (parent) {
                finalRoot = parent;
                current = parent;
            } else {
                break;
            }
        }
        return finalRoot.id;
    }, [focusedPersonId, getPersonById, ancestorsVisibleFor, childrenVisibleFor]);
    
    useLayoutEffect(() => {
        if (treeContainerRef.current) {
            const resizeObserver = new ResizeObserver(entries => {
                for (let entry of entries) {
                    setContentSize({
                        width: (entry.target as HTMLElement).offsetWidth,
                        height: (entry.target as HTMLElement).offsetHeight,
                    });
                }
            });
            resizeObserver.observe(treeContainerRef.current);
            return () => resizeObserver.disconnect();
        }
    }, [renderRootId]); // Re-observe when the root content changes fundamentally

    const scrollToCard = (personId: string) => {
        setTimeout(() => {
            const cardElement = document.getElementById(`person-card-${personId}`);
            cardElement?.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
                inline: 'center',
            });
        }, 100);
    };

    useEffect(() => {
        if (treeViewConfig) {
            handleRootPersonChange(treeViewConfig.rootId);
            setChildrenVisibleFor(new Set(treeViewConfig.visiblePath));
            
            setTimeout(() => {
                scrollToCard(treeViewConfig.rootId);
            }, 100);
            configureTreeView(null);
        }
    }, [treeViewConfig, configureTreeView]);


    useEffect(() => {
        if (renderRootId) {
            scrollToCard(renderRootId);
        }
    }, [renderRootId]);

    const handleRootPersonChange = (personId: string) => {
        setFocusedPersonId(personId);
        setChildrenVisibleFor(new Set());
        setSiblingsVisibleFor(null);
        setAncestorsVisibleFor(new Set());
    };

    const handleEdit = useCallback((person: Person) => openPersonForm(person), [openPersonForm]);
    
    const handleAddChild = useCallback((parent1Id: string, parent2Id: string) => {
        openPersonForm(undefined, { parentIds: [parent1Id, parent2Id] });
    }, [openPersonForm]);

    const handleToggleAncestors = useCallback((person: Person) => {
        setAncestorsVisibleFor(prev => {
            const newSet = new Set(prev);
            if (newSet.has(person.id)) {
                newSet.delete(person.id);
            } else {
                if (siblingsVisibleFor === person.id) {
                    setSiblingsVisibleFor(null);
                }
                newSet.add(person.id);
            }
            return newSet;
        });
        scrollToCard(person.id);
    }, [siblingsVisibleFor]);

    const handleToggleChildren = useCallback((person: Person) => {
        const isOpeningChildren = !childrenVisibleFor.has(person.id);

        if (isOpeningChildren && siblingsVisibleFor) {
            const personWithVisibleSiblings = getPersonById(siblingsVisibleFor);
            if (personWithVisibleSiblings?.parentIds?.includes(person.id)) {
                setSiblingsVisibleFor(null);
            }
        }

        setChildrenVisibleFor(prev => {
            const newSet = new Set(prev);
            if (newSet.has(person.id)) {
                newSet.delete(person.id);
            } else {
                newSet.add(person.id);
            }
            return newSet;
        });
        scrollToCard(person.id);
    }, [childrenVisibleFor, siblingsVisibleFor, getPersonById]);

    const handleNavigateToFamily = useCallback((person: Person) => {
        handleRootPersonChange(person.id);
    }, []);
    
    const handleToggleSiblings = useCallback((person: Person) => {
        setSiblingsVisibleFor(prev => (prev === person.id ? null : person.id));
        scrollToCard(person.id);
    }, []);

    const handleShowRelationshipPath = useCallback((person: Person) => {
        if (!focusedPersonId) return;
        const focalPerson = getPersonById(focusedPersonId);
        if (!focalPerson) return;
        const rels = findAllRelationships(focalPerson.id, person.id, people);
        if (rels.length > 0 && rels.some(r => r.type !== 'none')) {
            setRelationshipModalData({ person1: focalPerson, person2: person, relationships: rels });
        }
    }, [focusedPersonId, getPersonById, people]);

    const handleSwitchSpouse = useCallback((personId: string, direction: 'next' | 'prev') => {
        const person = getPersonById(personId);
        if (!person || !person.marriages || person.marriages.length <= 1) return;

        setActiveSpouseIndices(prev => {
            const newMap = new Map(prev);
            const currentIndex = newMap.get(personId) || 0;
            const numSpouses = person.marriages!.length;
            let nextIndex;

            if (direction === 'next') {
                nextIndex = (currentIndex + 1) % numSpouses;
            } else {
                nextIndex = (currentIndex - 1 + numSpouses) % numSpouses;
            }

            newMap.set(personId, nextIndex);
            return newMap;
        });
    }, [getPersonById]);

    const handleDownloadReport = async () => {
        if (!treeContainerRef.current) return;
        const personForFilename = getPersonById(focusedPersonId || renderRootId || '');
        if (!personForFilename) {
            alert("Please select a person to generate a report.");
            return;
        }
    
        setIsGeneratingPdf(true);
        
        const fileName = `Family_Tree_for_${getFullName(personForFilename)}`;
        
        const printableElement = document.createElement('div');
        printableElement.style.position = 'absolute';
        printableElement.style.left = '-9999px';
        printableElement.style.width = '297mm'; // A4 landscape
        printableElement.style.padding = '20px';
        printableElement.style.backgroundColor = 'white';
        printableElement.style.color = 'black';
        printableElement.style.fontFamily = 'sans-serif';
    
        const reportTitle = `<h1 style="font-size: 28px; font-weight: bold; text-align: center; margin-bottom: 20px;">Family Tree for ${getFullName(personForFilename)}</h1>`;
        printableElement.innerHTML = reportTitle;
    
        const treeClone = treeContainerRef.current.cloneNode(true) as HTMLElement;
        printableElement.appendChild(treeClone);
    
        document.body.appendChild(printableElement);
    
        try {
            await generatePdf(printableElement, fileName, 'l');
        } catch (error) {
            console.error("Error generating family tree PDF:", error);
            alert("Sorry, an error occurred while generating the PDF report.");
        } finally {
            if (document.body.contains(printableElement)) {
                document.body.removeChild(printableElement);
            }
            setIsGeneratingPdf(false);
        }
    };

    const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.1, 2));
    const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.1, 0.3));
    const handleResetZoom = () => setZoom(1);
    
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
                 {renderRootId && (
                    <div className="flex items-center space-x-1">
                        <Button size="sm" variant="secondary" onClick={handleZoomOut} aria-label="Zoom out"><MinusIcon /></Button>
                        <Button size="sm" variant="secondary" onClick={handleResetZoom} className="w-10">1x</Button>
                        <Button size="sm" variant="secondary" onClick={handleZoomIn} aria-label="Zoom in"><PlusIcon /></Button>
                    </div>
                 )}
                 <div className="flex-grow sm:flex-grow-0 max-w-md w-full sm:w-80">
                    <SearchableSelect
                        options={people}
                        value={focusedPersonId || ''}
                        onChange={handleRootPersonChange}
                        placeholder="Select a person to start the tree"
                    />
                 </div>
                 {renderRootId && (
                    <div className="flex items-center space-x-4">
                        <Button onClick={handleDownloadReport} disabled={isGeneratingPdf}>
                            {isGeneratingPdf ? <SpinnerIcon /> : <PrintIcon />}
                            <span className="ml-2 hidden sm:inline">{isGeneratingPdf ? 'Generating...' : 'Download Report'}</span>
                        </Button>
                    </div>
                 )}
            </div>
            
            <div className="overflow-auto p-6 bg-gray-50 dark:bg-gray-800/50">
                {!renderRootId && (
                    <div className="flex items-center justify-center h-full">
                        <div className="text-center p-8">
                            <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200">Please select a person to begin</h3>
                            <p className="mt-2 text-gray-500 dark:text-gray-400">
                                Use the search bar above to find an individual and start building the tree.
                            </p>
                        </div>
                    </div>
                )}
                {renderRootId && (
                    <>
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
                                <div ref={treeContainerRef} className="inline-block">
                                    <FamilyNode
                                        personId={renderRootId}
                                        onEdit={handleEdit}
                                        onToggleAncestors={handleToggleAncestors}
                                        onNavigateToFamily={handleNavigateToFamily}
                                        onToggleChildren={handleToggleChildren}
                                        onSwitchSpouse={handleSwitchSpouse}
                                        onToggleSiblings={handleToggleSiblings}
                                        onShowRelationshipPath={handleShowRelationshipPath}
                                        onAddChild={handleAddChild}
                                        processedIds={new Set()}
                                        allPeople={people}
                                        siblingsVisibleFor={siblingsVisibleFor}
                                        childrenVisibleFor={childrenVisibleFor}
                                        ancestorsVisibleFor={ancestorsVisibleFor}
                                        activeSpouseIndices={activeSpouseIndices}
                                        bloodRelativesIds={bloodRelativesIds}
                                        relationshipDescriptions={relationshipDescriptions}
                                    />
                                </div>
                            </div>
                        </div>
                        <RelationshipPathModal
                            isOpen={!!relationshipModalData}
                            onClose={() => setRelationshipModalData(null)}
                            data={relationshipModalData}
                        />
                    </>
                )}
            </div>
        </div>
    );
};
