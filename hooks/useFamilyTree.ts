
import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Tree, Trees, Person, Gender, Marriage, MarriageStatus } from '../types.ts';
import { parseGedcom, exportToGedcom } from '../services/gedcomService.ts';
import { getAllTrees, saveTree, deleteTreeFromDB, getAppState, saveAppState } from '../services/dbService.ts';
import saveAs from 'file-saver';
import { getFullName } from '../utils/personUtils.ts';

export const useFamilyTree = () => {
    const [data, setData] = useState<{ trees: Trees; activeTreeId: string }>({ trees: {}, activeTreeId: '' });
    const [isLoading, setIsLoading] = useState(true);
    const [treeViewConfig, setTreeViewConfig] = useState<{ rootId: string; visiblePath: string[] } | null>(null);
    const { trees, activeTreeId } = data;

    useEffect(() => {
        const loadData = async () => {
            try {
                const [loadedTrees, loadedActiveTreeId] = await Promise.all([
                    getAllTrees(),
                    getAppState('activeTreeId')
                ]);

                if (Object.keys(loadedTrees).length > 0) {
                    const activeId = loadedActiveTreeId && loadedTrees[loadedActiveTreeId] ? loadedActiveTreeId : Object.keys(loadedTrees)[0];
                    setData({ trees: loadedTrees, activeTreeId: activeId });
                } else {
                    // Create default tree if DB is empty
                    const defaultTreeId = uuidv4();
                    const defaultTree: Tree = {
                        id: defaultTreeId,
                        name: 'My First Tree',
                        people: [],
                    };
                    await saveTree(defaultTree);
                    await saveAppState('activeTreeId', defaultTreeId);
                    setData({ trees: { [defaultTreeId]: defaultTree }, activeTreeId: defaultTreeId });
                }
            } catch (error) {
                console.error("Failed to load data from IndexedDB", error);
                alert("Error: Could not load family data. Your browser may not support IndexedDB or it may be in a private/incognito mode.");
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, []);


    const activeTree = trees[activeTreeId];
    const people = activeTree ? activeTree.people : [];

    const updatePeople = useCallback(async (newPeople: Person[]) => {
        if (!activeTreeId || !activeTree) return;

        const updatedTree = { ...activeTree, people: newPeople };

        setData(prevData => ({
            ...prevData,
            trees: {
                ...prevData.trees,
                [activeTreeId]: updatedTree,
            },
        }));

        await saveTree(updatedTree);
    }, [activeTreeId, activeTree]);

    const createNewTree = async (name: string) => {
        const newTreeId = uuidv4();
        const newTree: Tree = { id: newTreeId, name, people: [] };
        
        setData(prevData => ({
            activeTreeId: newTreeId,
            trees: {
                ...prevData.trees,
                [newTreeId]: newTree,
            },
        }));

        await saveTree(newTree);
        await saveAppState('activeTreeId', newTreeId);
    };

    const switchTree = async (treeId: string) => {
        if (trees[treeId]) {
            setData(prevData => ({ ...prevData, activeTreeId: treeId }));
            await saveAppState('activeTreeId', treeId);
        }
    };

    const deleteTree = async (treeId: string) => {
        const newTrees = { ...trees };
        delete newTrees[treeId];
        
        const remainingTreeIds = Object.keys(newTrees);
        
        let newActiveTreeId = activeTreeId;
        if (newActiveTreeId === treeId) {
            newActiveTreeId = remainingTreeIds.length > 0 ? remainingTreeIds[0] : '';
        }

        setData({
            trees: newTrees,
            activeTreeId: newActiveTreeId,
        });

        await deleteTreeFromDB(treeId);
        await saveAppState('activeTreeId', newActiveTreeId);
    };

    const addPerson = async (personData: Omit<Person, 'id' | 'childrenIds' | 'marriages'>) => {
        const newPerson: Person = {
            ...personData,
            id: uuidv4(),
            childrenIds: [],
            marriages: [],
        };
        const newPeople = [...people, newPerson];
        
        if (newPerson.parentIds && newPerson.parentIds.length === 2) {
            const [p1Id, p2Id] = newPerson.parentIds;
            addSpouseRelationship(p1Id, p2Id, newPeople);
            addChildToParent(newPerson.id, p1Id, newPeople);
            addChildToParent(newPerson.id, p2Id, newPeople);
        }
        await updatePeople(newPeople);
    };

    const updatePerson = async (personId: string, updatedData: Partial<Person>) => {
        let newPeople = [...people];
        const personIndex = newPeople.findIndex(p => p.id === personId);
        if (personIndex === -1) return;

        const oldPerson = newPeople[personIndex];

        // Handle parent changes
        if (updatedData.parentIds && JSON.stringify(oldPerson.parentIds) !== JSON.stringify(updatedData.parentIds)) {
            // Remove from old parents
            if (oldPerson.parentIds) {
                oldPerson.parentIds.forEach(parentId => {
                    removeChildFromParent(personId, parentId, newPeople);
                });
            }
            // Add to new parents
            if (updatedData.parentIds) {
                if (updatedData.parentIds.length === 2) {
                    const [p1Id, p2Id] = updatedData.parentIds;
                    addSpouseRelationship(p1Id, p2Id, newPeople);
                }
                updatedData.parentIds.forEach(parentId => {
                    addChildToParent(personId, parentId, newPeople);
                });
            }
        }

        // Handle marriage changes symmetrically
        if (updatedData.marriages) {
            const oldMarriages = oldPerson.marriages || [];
            const newMarriages = updatedData.marriages;

            const oldSpouseIds = oldMarriages.map(m => m.spouseId);
            const newSpouseIds = newMarriages.map(m => m.spouseId);

            // Spouses to remove connection from
            const removedSpouseIds = oldSpouseIds.filter(id => !newSpouseIds.includes(id));
            for (const spouseId of removedSpouseIds) {
                const spouseIndex = newPeople.findIndex(p => p.id === spouseId);
                if (spouseIndex !== -1) {
                    newPeople[spouseIndex].marriages = newPeople[spouseIndex].marriages?.filter(m => m.spouseId !== personId);
                }
            }

            // Spouses to add or update connection with
            for (const marriage of newMarriages) {
                const spouseIndex = newPeople.findIndex(p => p.id === marriage.spouseId);
                if (spouseIndex !== -1) {
                    const spouse = newPeople[spouseIndex];
                    const reciprocalMarriage = { ...marriage, spouseId: personId };

                    const existingMarriageIndex = spouse.marriages?.findIndex(m => m.spouseId === personId) ?? -1;
                    if (existingMarriageIndex !== -1 && spouse.marriages) {
                        spouse.marriages[existingMarriageIndex] = reciprocalMarriage;
                    } else {
                        spouse.marriages = [...(spouse.marriages || []), reciprocalMarriage];
                    }
                }
            }
        }
        
        newPeople[personIndex] = { ...oldPerson, ...updatedData };
        await updatePeople(newPeople);
    };

    const deletePerson = async (personId: string) => {
        let newPeople = [...people];
        const personToDelete = newPeople.find(p => p.id === personId);
        if (!personToDelete) return;

        // Remove from parents' children list
        if (personToDelete.parentIds) {
            personToDelete.parentIds.forEach(parentId => {
                const parentIndex = newPeople.findIndex(p => p.id === parentId);
                if (parentIndex !== -1) {
                    newPeople[parentIndex].childrenIds = newPeople[parentIndex].childrenIds?.filter(id => id !== personId);
                }
            });
        }

        // Remove from children's parent list
        if (personToDelete.childrenIds) {
            personToDelete.childrenIds.forEach(childId => {
                const childIndex = newPeople.findIndex(p => p.id === childId);
                if (childIndex !== -1) {
                    newPeople[childIndex].parentIds = newPeople[childIndex].parentIds?.filter(id => id !== personId);
                }
            });
        }

        // Remove from spouses' marriage list
        if (personToDelete.marriages) {
            personToDelete.marriages.forEach(marriage => {
                const spouseIndex = newPeople.findIndex(p => p.id === marriage.spouseId);
                if (spouseIndex !== -1) {
                    newPeople[spouseIndex].marriages = newPeople[spouseIndex].marriages?.filter(m => m.spouseId !== personId);
                }
            });
        }
        
        const finalPeople = newPeople.filter(p => p.id !== personId);
        await updatePeople(finalPeople);
    };
    
    const addSpouseRelationship = (p1Id: string, p2Id: string, currentPeople: Person[]) => {
        const p1Index = currentPeople.findIndex(p => p.id === p1Id);
        const p2Index = currentPeople.findIndex(p => p.id === p2Id);
        if (p1Index === -1 || p2Index === -1) return;

        const p1 = currentPeople[p1Index];
        const p2 = currentPeople[p2Index];

        const p1HasSpouse = p1.marriages?.some(m => m.spouseId === p2Id);
        if (!p1HasSpouse) {
            p1.marriages = [...(p1.marriages || []), { spouseId: p2Id, status: MarriageStatus.Married }];
        }
        const p2HasSpouse = p2.marriages?.some(m => m.spouseId === p1Id);
        if (!p2HasSpouse) {
            p2.marriages = [...(p2.marriages || []), { spouseId: p1Id, status: MarriageStatus.Married }];
        }
    };

    const addChildToParent = (childId: string, parentId: string, currentPeople: Person[]) => {
        const parentIndex = currentPeople.findIndex(p => p.id === parentId);
        if (parentIndex !== -1) {
            const parent = currentPeople[parentIndex];
            if (!parent.childrenIds?.includes(childId)) {
                parent.childrenIds = [...(parent.childrenIds || []), childId];
            }
        }
    };
    
    const removeChildFromParent = (childId: string, parentId: string, currentPeople: Person[]) => {
        const parentIndex = currentPeople.findIndex(p => p.id === parentId);
        if (parentIndex !== -1) {
            currentPeople[parentIndex].childrenIds = currentPeople[parentIndex].childrenIds?.filter(id => id !== childId);
        }
    };

    const importGedcom = (file: File) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const content = e.target?.result as string;
            try {
                const newPeople = parseGedcom(content);
                const treeName = file.name.replace(/\.ged$/i, '');
                const newTreeId = uuidv4();
                const newTree: Tree = { id: newTreeId, name: treeName, people: newPeople };

                setData(prev => ({
                    activeTreeId: newTreeId,
                    trees: { ...prev.trees, [newTreeId]: newTree },
                }));
                await saveTree(newTree);
                await saveAppState('activeTreeId', newTreeId);
                alert(`Successfully imported ${newPeople.length} individuals into new tree "${treeName}".`);
            } catch (error) {
                console.error("GEDCOM parsing error:", error);
                alert("Failed to parse GEDCOM file. Please check the file format and console for details.");
            }
        };
        reader.readAsText(file);
    };

    const exportGedcom = (treeId: string) => {
        const treeToExp = trees[treeId];
        if (!treeToExp) {
            alert("No active tree to export.");
            return;
        }
        try {
            const gedcomString = exportToGedcom(treeToExp.people);
            const blob = new Blob([gedcomString], { type: 'text/plain;charset=utf-8' });
            saveAs(blob, `${treeToExp.name.replace(/\s/g, '_')}.ged`);
        } catch (error) {
            console.error("GEDCOM export error:", error);
            alert("Failed to export to GEDCOM. See console for details.");
        }
    };
    
    const backupActiveTree = () => {
        const treeToBackup = trees[activeTreeId];
        if (!treeToBackup) {
            alert("No active tree to backup.");
            return;
        }
        try {
            const backupData = JSON.stringify(treeToBackup, null, 2);
            const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
            
            let baseName = treeToBackup.name;
            baseName = baseName
                .replace(/\s\(Restored .*\)$/, '')
                .replace(/_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/, '')
                .trim();

            const filename = `${baseName.replace(/\s/g, '_')}_${timestamp}.json`;
            const blob = new Blob([backupData], { type: 'application/json;charset=utf-8' });
            saveAs(blob, filename);
        } catch (error) {
            console.error("Backup error:", error);
            alert("Failed to create backup. See console for details.");
        }
    };

    const importBackup = (file: File) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const content = e.target?.result as string;
            try {
                const importedTreeData: Tree = JSON.parse(content);

                if (!importedTreeData || typeof importedTreeData !== 'object' || !importedTreeData.name || !Array.isArray(importedTreeData.people)) {
                    throw new Error("Invalid backup file format.");
                }

                const newTreeId = uuidv4();
                const timestamp = new Date().toISOString().split('T')[0];
                
                const newTree: Tree = {
                    ...importedTreeData,
                    id: newTreeId,
                    name: `${importedTreeData.name.replace(/\s\(Restored .*\)$/, '')} (Restored ${timestamp})`,
                };

                setData(prev => ({
                    activeTreeId: newTreeId,
                    trees: { ...prev.trees, [newTreeId]: newTree },
                }));
                await saveTree(newTree);
                await saveAppState('activeTreeId', newTreeId);
                alert(`Successfully imported tree. It has been added as "${newTree.name}" and is now active.`);
            } catch (error) {
                console.error("Backup import error:", error);
                alert("Failed to import backup file. Please check the file format and console for details.");
            }
        };
        reader.readAsText(file);
    };

    const mergeTrees = async (tree1Id: string, tree2Id: string, matches: { person1Id: string; person2Id: string; }[]): Promise<Tree | undefined> => {
        const tree1 = trees[tree1Id];
        const tree2 = trees[tree2Id];
        if (!tree1 || !tree2) {
            alert("One or both of the selected trees could not be found.");
            return undefined;
        }

        const idMap = new Map<string, string>(); // <oldId, newId>
        const newPeople: Person[] = [];

        // 1. Copy all people from tree1 and create new IDs for them
        tree1.people.forEach(p => {
            const newId = uuidv4();
            idMap.set(p.id, newId);
            // Push a deep copy with the new ID
            newPeople.push(JSON.parse(JSON.stringify({ ...p, id: newId })));
        });

        // 2. Use the matches to map tree2 person IDs to the new tree1 person IDs
        matches.forEach(match => {
            const person1NewId = idMap.get(match.person1Id);
            if (person1NewId) {
                idMap.set(match.person2Id, person1NewId);
            }
        });

        // 3. Process people from tree2
        tree2.people.forEach(p2_original => {
            const p2 = JSON.parse(JSON.stringify(p2_original)); // work with a copy
            const mappedId = idMap.get(p2.id);

            if (mappedId) {
                // This person is being merged. Find their counterpart in newPeople and merge data.
                const p1Index = newPeople.findIndex(p1 => p1.id === mappedId);
                if (p1Index !== -1) {
                    const p1 = newPeople[p1Index];
                    
                    // Merge logic: p2's data overwrites p1's only if p1's is empty
                    Object.keys(p2).forEach(key => {
                        const k = key as keyof Person;
                        if (!p1[k] && p2[k]) (p1 as any)[k] = p2[k];
                    });

                    p1.notes = [p1.notes, p2.notes].filter(Boolean).join('\n---\n');
                    p1.photos = [...new Set([...(p1.photos || []), ...(p2.photos || [])])];
                    p1.parentIds = [...new Set([...(p1.parentIds || []), ...(p2.parentIds || [])])];
                    p1.childrenIds = [...new Set([...(p1.childrenIds || []), ...(p2.childrenIds || [])])];
                    
                    const p1SpouseIds = new Set(p1.marriages?.map(m => m.spouseId));
                    const p2MarriagesToAdd = p2.marriages?.filter(m => !p1SpouseIds.has(m.spouseId)) || [];
                    p1.marriages = [...(p1.marriages || []), ...p2MarriagesToAdd];
                }
            } else {
                // This person is not part of a match, so just add them as a new person.
                const newId = uuidv4();
                idMap.set(p2.id, newId);
                newPeople.push({ ...p2, id: newId });
            }
        });
        
        // 4. Final pass to remap all relationships
        const finalNewPeople = newPeople.map(p => ({
            ...p,
            parentIds: [...new Set(p.parentIds?.map(id => idMap.get(id)).filter(Boolean) as string[])],
            childrenIds: [...new Set(p.childrenIds?.map(id => idMap.get(id)).filter(Boolean) as string[])],
            marriages: p.marriages?.map(m => ({ ...m, spouseId: idMap.get(m.spouseId)! })).filter(m => m.spouseId),
        }));
        
        const cleanTreeName = (name: string): string => {
            return name
                .replace(/\s\(Restored .*\)$/, '')
                .replace(/_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/, '')
                .trim();
        };

        const cleanName1 = cleanTreeName(tree1.name);
        const cleanName2 = cleanTreeName(tree2.name);
        const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');

        const newTreeId = uuidv4();
        const newTree: Tree = {
            id: newTreeId,
            name: `Merged: ${cleanName1} & ${cleanName2} (${timestamp})`,
            people: finalNewPeople,
        };
        
        setData(prev => ({
            activeTreeId: newTreeId,
            trees: { ...prev.trees, [newTreeId]: newTree },
        }));
        await saveTree(newTree);
        await saveAppState('activeTreeId', newTreeId);
        return newTree;
    };

    const splitTree = async (sourceTreeId: string, rootPersonIds: string[]): Promise<string[]> => {
        const sourceTree = trees[sourceTreeId];
        if (!sourceTree || rootPersonIds.length === 0) {
            return [];
        }

        const newTreesCreated: Tree[] = [];
        
        const getDescendantsRecursive = (personId: string, sourcePeople: Person[], allDescendantIds: Set<string>) => {
            if (allDescendantIds.has(personId)) return;
        
            const person = sourcePeople.find(p => p.id === personId);
            if (!person) return;
            
            allDescendantIds.add(personId);
        
            if (!person.childrenIds) return;
        
            for (const childId of person.childrenIds) {
                getDescendantsRecursive(childId, sourcePeople, allDescendantIds);
            }
        };

        for (const rootPersonId of rootPersonIds) {
            const rootPerson = sourceTree.people.find(p => p.id === rootPersonId);
            if (!rootPerson) continue;
            
            const descendantIds = new Set<string>();
            getDescendantsRecursive(rootPersonId, sourceTree.people, descendantIds);

            // Also include spouses of all descendants
            const newTreeMemberIds = new Set(descendantIds);
            descendantIds.forEach(id => {
                const person = sourceTree.people.find(p => p.id === id);
                person?.marriages?.forEach(m => newTreeMemberIds.add(m.spouseId));
            });
            
            const newTreePeople = sourceTree.people
                .filter(p => newTreeMemberIds.has(p.id))
                .map(p => JSON.parse(JSON.stringify(p))); // Deep copy

            // Clean up relationships to point only within the new tree
            newTreePeople.forEach(person => {
                if (person.parentIds) {
                    person.parentIds = person.parentIds.filter(id => newTreeMemberIds.has(id));
                }
                if (person.marriages) {
                    person.marriages = person.marriages.filter(m => newTreeMemberIds.has(m.spouseId));
                }
                if (person.childrenIds) {
                    person.childrenIds = person.childrenIds.filter(id => newTreeMemberIds.has(id));
                }
            });

            // Create and save the new tree
            const newTreeId = uuidv4();
            const newTreeName = `${getFullName(rootPerson)}'s Lineage`;
            const newTree: Tree = { id: newTreeId, name: newTreeName, people: newTreePeople };

            await saveTree(newTree);
            newTreesCreated.push(newTree);
        }

        // Update state with the newly created trees
        const currentTrees = await getAllTrees();
        const newActiveTreeId = newTreesCreated.length > 0 ? newTreesCreated[0].id : activeTreeId;
        setData({
            trees: currentTrees,
            activeTreeId: newActiveTreeId,
        });
        await saveAppState('activeTreeId', newActiveTreeId);
        
        return newTreesCreated.map(t => t.id);
    };

    const getPersonById = useCallback((id: string) => people.find(p => p.id === id), [people]);

    const configureTreeView = (config: { rootId: string; visiblePath: string[] } | null) => {
        setTreeViewConfig(config);
    };

    return {
        isLoading,
        trees,
        activeTreeId,
        activeTree,
        people,
        getPersonById,
        addPerson,
        updatePerson,
        deletePerson,
        createNewTree,
        switchTree,
        deleteTree,
        importGedcom,
        exportGedcom,
        backupActiveTree,
        importBackup,
        mergeTrees,
        splitTree,
        treeViewConfig,
        configureTreeView,
    };
};

export const FamilyTreeContext = createContext<ReturnType<typeof useFamilyTree> | null>(null);

export const useFamilyTreeContext = () => {
    const context = useContext(FamilyTreeContext);
    if (!context) {
        throw new Error('useFamilyTreeContext must be used within a FamilyTreeProvider');
    }
    return context;
};
