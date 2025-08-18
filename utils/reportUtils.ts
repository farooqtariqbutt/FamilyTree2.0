import type { Person } from '../types.ts';
import { Gender } from '../types.ts';
import { getFullName } from './personUtils.ts';


const getPersonById = (id: string, allPeople: Person[]) => allPeople.find(p => p.id === id);


export const getAncestorsHierarchically = (person: Person, allPeople: Person[]): { person: Person, level: number }[] => {
    const results: { person: Person, level: number }[] = [];
    if (!person.parentIds) return results;

    const queue: { personId: string; level: number }[] = (person.parentIds || []).map(id => ({ personId: id, level: 1 }));
    const visited = new Set<string>();

    while (queue.length > 0) {
        const { personId, level } = queue.shift()!;
        if (!personId || visited.has(personId)) continue;
        visited.add(personId);

        const p = getPersonById(personId, allPeople);
        if (p) {
            results.push({ person: p, level });
            p.parentIds?.forEach(parentId => {
                if (!visited.has(parentId)) {
                    queue.push({ personId: parentId, level: level + 1 });
                }
            });
        }
    }
    return results;
};

export const getDescendantsWithRelationship = (person: Person, allPeople: Person[]): { person: Person, relationship: string, generation: number }[] => {
    const results: { person: Person, relationship: string, generation: number }[] = [];
    if (!person.childrenIds) return results;

    const queue: { personId: string; generation: number }[] = person.childrenIds.map(id => ({ personId: id, generation: 1 }));
    const visited = new Set<string>();

    while (queue.length > 0) {
        const { personId, generation } = queue.shift()!;
        if (!personId || visited.has(personId)) continue;
        visited.add(personId);

        const p = getPersonById(personId, allPeople);
        if (p) {
            let relationship = '';
            if (generation === 1) {
                relationship = p.gender === Gender.Male ? 'Son' : p.gender === Gender.Female ? 'Daughter' : 'Child';
            } else if (generation === 2) {
                relationship = p.gender === Gender.Male ? 'Grandson' : p.gender === Gender.Female ? 'Granddaughter' : 'Grandchild';
            } else { // generation > 2
                const prefix = 'Great-'.repeat(generation - 2);
                relationship = p.gender === Gender.Male ? `${prefix}Grandson` : p.gender === Gender.Female ? `${prefix}Granddaughter` : `${prefix}Grandchild`;
            }
            
            results.push({ person: p, relationship, generation });
            
            p.childrenIds?.forEach(childId => {
                if (!visited.has(childId)) {
                    queue.push({ personId: childId, generation: generation + 1 });
                }
            });
        }
    }
    return results;
};


export const getAncestorsWithRelationship = (person: Person, allPeople: Person[]): { person: Person, relationship: string }[] => {
    const resultsMap = new Map<string, { person: Person, relationships: Set<string> }>();

    const getAncestorsForLineage = (
        startParentIds: string[],
        getParentsFn: (p: Person) => string[],
        lineageType?: 'Adoptive' | 'Biological'
    ) => {
        const queue: { personId: string; generation: number; lineage: 'Paternal' | 'Maternal' | null }[] = [];
        // Visited set is per-traversal to avoid infinite loops within a single line (e.g. pedigree collapse)
        const visited = new Set<string>();

        (startParentIds || []).forEach(parentId => {
            const parent = getPersonById(parentId, allPeople);
            if (parent) {
                const lineage = parent.gender === Gender.Male ? 'Paternal' : parent.gender === Gender.Female ? 'Maternal' : null;
                queue.push({ personId: parentId, generation: 1, lineage });
            }
        });

        while (queue.length > 0) {
            const { personId, generation, lineage } = queue.shift()!;
            if (!personId || visited.has(personId)) continue;
            visited.add(personId);

            const p = getPersonById(personId, allPeople);
            if (p) {
                let relationship: string;
                const lineageSuffix = (generation > 1 && lineage) ? ` (${lineage})` : '';

                if (generation === 1) {
                    relationship = p.gender === Gender.Male ? 'Father' : p.gender === Gender.Female ? 'Mother' : 'Parent';
                } else if (generation === 2) {
                    relationship = p.gender === Gender.Male ? 'Grandfather' : p.gender === Gender.Female ? 'Grandmother' : 'Grandparent';
                } else {
                    const prefix = 'Great-'.repeat(generation - 2);
                    relationship = p.gender === Gender.Male ? `${prefix}Grandfather` : p.gender === Gender.Female ? `${prefix}Grandmother` : `${prefix}Grandparent`;
                }

                const typeSuffix = lineageType ? ` - ${lineageType}` : '';
                const finalRelationship = `${relationship}${lineageSuffix}${typeSuffix}`;
                
                if (resultsMap.has(p.id)) {
                    resultsMap.get(p.id)!.relationships.add(finalRelationship);
                } else {
                    resultsMap.set(p.id, { person: p, relationships: new Set([finalRelationship]) });
                }

                const nextParentIds = getParentsFn(p);
                nextParentIds.forEach(parentId => {
                    if (!visited.has(parentId)) {
                        queue.push({ personId: parentId, generation: generation + 1, lineage });
                    }
                });
            }
        }
    };
    
    // Traverses the legal/adoptive family tree line
    const getAdoptiveParents = (p: Person) => p.parentIds || [];
    // Traverses the biological family tree line
    const getBiologicalParents = (p: Person) => (p.isAdopted) ? (p.biologicalParentIds || []) : (p.parentIds || []);

    if (person.isAdopted) {
        if (person.parentIds && person.parentIds.length > 0) {
            getAncestorsForLineage(person.parentIds, getAdoptiveParents, 'Adoptive');
        }
        if (person.biologicalParentIds && person.biologicalParentIds.length > 0) {
            getAncestorsForLineage(person.biologicalParentIds, getBiologicalParents, 'Biological');
        }
    } else {
        // For a non-adopted person, their main parents are their biological parents
        if (person.parentIds && person.parentIds.length > 0) {
            getAncestorsForLineage(person.parentIds, getBiologicalParents);
        }
    }

    return Array.from(resultsMap.values()).map(entry => ({
        person: entry.person,
        relationship: Array.from(entry.relationships).join(' & ')
    }));
};

export const getSiblingsWithRelationship = (person: Person, allPeople: Person[]): { person: Person, relationship: string }[] => {
    if (!person.parentIds || person.parentIds.length === 0) {
        return [];
    }
    const parentIdSet = new Set(person.parentIds.filter(id => id));
    if (parentIdSet.size === 0) return [];

    return allPeople.filter(p => {
        if (p.id === person.id) return false;
        if (!p.parentIds) return false;
        return p.parentIds.some(pid => parentIdSet.has(pid));
    })
    .map(sibling => ({
        person: sibling,
        relationship: sibling.gender === Gender.Male ? 'Brother' : sibling.gender === Gender.Female ? 'Sister' : 'Sibling'
    }));
};
