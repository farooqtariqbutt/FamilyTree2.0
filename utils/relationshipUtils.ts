
import { Gender, type Person } from '../types.ts';
import { getFullName } from './personUtils.ts';

const getPersonById = (id: string, allPeople: Person[]): Person | undefined => {
    return allPeople.find(p => p.id === id);
}

const getAncestors = (person: Person, allPeople: Person[]): Person[] => {
    const ancestors: Person[] = [];
    const queue = [...(person.parentIds || [])];
    const visited = new Set<string>();

    while (queue.length > 0) {
        const personId = queue.shift()!;
        if (visited.has(personId) || !personId) continue;
        visited.add(personId);

        const p = getPersonById(personId, allPeople);
        if (p) {
            ancestors.push(p);
            p.parentIds?.forEach(parentId => {
                if (!visited.has(parentId)) {
                    queue.push(parentId);
                }
            });
        }
    }
    return ancestors;
};

const getDescendants = (person: Person, allPeople: Person[]): Person[] => {
    const descendants: Person[] = [];
    const queue = [...(person.childrenIds || [])];
    const visited = new Set<string>();

    while (queue.length > 0) {
        const personId = queue.shift()!;
        if (visited.has(personId) || !personId) continue;
        visited.add(personId);

        const p = getPersonById(personId, allPeople);
        if (p) {
            descendants.push(p);
            p.childrenIds?.forEach(childId => {
                if (!visited.has(childId)) {
                    queue.push(childId);
                }
            });
        }
    }
    return descendants;
};

export const getAllBloodRelativesIds = (focalPerson: Person, allPeople: Person[]): Set<string> => {
    const bloodRelatives = new Set<string>();
    if (!focalPerson) return bloodRelatives;

    // The person, their ancestors, and all descendants of those ancestors form the bloodline.
    const allProgenitors = [focalPerson, ...getAncestors(focalPerson, allPeople)];

    for (const progenitor of allProgenitors) {
        bloodRelatives.add(progenitor.id);
        const descendants = getDescendants(progenitor, allPeople);
        for (const descendant of descendants) {
            bloodRelatives.add(descendant.id);
        }
    }
    return bloodRelatives;
};


// --- Relationship Pathfinding and Description Logic ---

const findLcaAndPaths = (person1Id: string, person2Id: string, allPeople: Person[]): { lca: Person; path1: Person[]; path2: Person[] } | null => {
    const getPerson = (id: string) => getPersonById(id, allPeople);

    // Helper to get path from a person up to a specific ancestor using BFS for shortest path
    const getPathToAncestor = (startId: string, endId: string): Person[] | null => {
        const startPerson = getPerson(startId);
        if (!startPerson) return null;
        if (startId === endId) return [startPerson];

        const queue: { personId: string; path: Person[] }[] = [{ personId: startId, path: [startPerson] }];
        const visited = new Set<string>([startId]);

        while (queue.length > 0) {
            const { personId, path } = queue.shift()!;
            const currentPerson = getPerson(personId);

            if (currentPerson?.parentIds) {
                for (const parentId of currentPerson.parentIds) {
                    if (!visited.has(parentId)) {
                        visited.add(parentId);
                        const parentPerson = getPerson(parentId);
                        if (parentPerson) {
                            const newPath = [...path, parentPerson];
                            if (parentId === endId) {
                                return newPath;
                            }
                            queue.push({ personId: parentId, path: newPath });
                        }
                    }
                }
            }
        }
        return null;
    }

    // Get all ancestors of person 1 (id -> person)
    const p1Ancestors = new Map<string, Person>();
    const queue1: string[] = [person1Id];
    const visited1 = new Set<string>();

    while (queue1.length > 0) {
        const currentId = queue1.shift()!;
        if (visited1.has(currentId)) continue;
        visited1.add(currentId);
        const person = getPerson(currentId);
        if (person) {
            p1Ancestors.set(currentId, person);
            if (person.parentIds) {
                queue1.push(...person.parentIds);
            }
        }
    }

    // Traverse up from person 2 (BFS) and find the first common ancestor
    const queue2: string[] = [person2Id];
    const visited2 = new Set<string>([person2Id]);

    while (queue2.length > 0) {
        const currentId = queue2.shift()!;
        if (p1Ancestors.has(currentId)) {
            const lca = p1Ancestors.get(currentId)!;
            const path1 = getPathToAncestor(person1Id, lca.id);
            const path2 = getPathToAncestor(person2Id, lca.id);
            
            if (path1 && path2) {
                return { lca, path1, path2 };
            }
        }

        const person = getPerson(currentId);
        if (person?.parentIds) {
            for (const parentId of person.parentIds) {
                if (!visited2.has(parentId)) {
                    visited2.add(parentId);
                    queue2.push(parentId);
                }
            }
        }
    }

    return null;
}


const ordinal = (n: number): string => {
    if (n <= 0) return String(n);
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// Describes person2's relationship to person1
const describeBloodRelationship = (person1: Person, person2: Person, lca: Person, path1: Person[], path2: Person[]): string => {
    const d1 = path1.length - 1; // generations from person1 to lca
    const d2 = path2.length - 1; // generations from person2 to lca

    // Case 1: person1 is the LCA. person2 is a descendant of person1.
    if (lca.id === person1.id) {
        const d = d2;
        if (d === 0) return 'Self';
        if (d === 1) return person2.gender === Gender.Male ? 'Son' : person2.gender === Gender.Female ? 'Daughter' : 'Child';
        if (d === 2) return person2.gender === Gender.Male ? 'Grandson' : person2.gender === Gender.Female ? 'Granddaughter' : 'Grandchild';
        const prefix = 'Great-'.repeat(d - 2);
        return `${prefix}${person2.gender === Gender.Male ? 'Grandson' : person2.gender === Gender.Female ? 'Granddaughter' : 'Grandchild'}`;
    }

    // Case 2: person2 is the LCA. person2 is an ancestor of person1.
    if (lca.id === person2.id) {
        const d = d1;
        if (d === 0) return 'Self';
        if (d === 1) return person2.gender === Gender.Male ? 'Father' : person2.gender === Gender.Female ? 'Mother' : 'Parent';
        if (d === 2) return person2.gender === Gender.Male ? 'Grandfather' : person2.gender === Gender.Female ? 'Grandmother' : 'Grandparent';
        const prefix = 'Great-'.repeat(d - 2);
        return `${prefix}${person2.gender === Gender.Male ? 'Grandfather' : person2.gender === Gender.Female ? 'Grandmother' : 'Grandparent'}`;
    }

    // Case 3: Siblings
    if (d1 === 1 && d2 === 1) {
        return person2.gender === Gender.Male ? 'Brother' : person2.gender === Gender.Female ? 'Sister' : 'Sibling';
    }

    // Case 4: Aunt/Uncle/Niece/Nephew or Cousins
    const cousinLevel = Math.min(d1, d2) - 1;
    const removalLevel = Math.abs(d1 - d2);

    if (cousinLevel === 0) { // Aunt/Uncle/Niece/Nephew
        const prefix = removalLevel > 1 ? `Grand` : '';
        if (d1 < d2) { // person1 is closer to LCA -> uncle/aunt line. person2 is on nephew/niece line.
            const relation = person2.gender === Gender.Male ? 'nephew' : person2.gender === Gender.Female ? 'niece' : 'nephew/niece';
            return `${prefix}${relation}`;
        } else { // person2 is closer to LCA -> uncle/aunt line.
            const relation = person2.gender === Gender.Male ? 'uncle' : person2.gender === Gender.Female ? 'aunt' : 'aunt/uncle';
            return `${prefix}${relation}`;
        }
    }
    
    // Cousins
    const cousinTerm = ordinal(cousinLevel);
    const removalTerm = removalLevel > 0 ? `, ${removalLevel === 1 ? 'once' : removalLevel === 2 ? 'twice' : `${removalLevel} times`} removed` : '';

    return `${cousinTerm} cousin${removalTerm}`;
};


const getPathSegmentDescription = (p1: Person, p2: Person): string => {
    if (p1.childrenIds?.includes(p2.id)) {
        return p1.gender === Gender.Male ? 'is the father of' : p1.gender === Gender.Female ? 'is the mother of' : 'is the parent of';
    }
    if (p1.parentIds?.includes(p2.id)) {
        return p1.gender === Gender.Male ? 'is the son of' : p1.gender === Gender.Female ? 'is the daughter of' : 'is the child of';
    }
    if (p1.marriages?.some(m => m.spouseId === p2.id)) {
        return p1.gender === Gender.Male ? 'is the husband of' : p1.gender === Gender.Female ? 'is the wife of' : 'is the spouse of';
    }
    return 'is related to';
}

const generatePathDescription = (path: Person[]): string => {
    if (path.length < 2) return "They are the same person.";
    
    let description = getFullName(path[0]);
    for (let i = 0; i < path.length - 1; i++) {
        const p1 = path[i];
        const p2 = path[i+1];
        const relation = getPathSegmentDescription(p1, p2);
        description += (i > 0 ? ', who ' : ' ') + `${relation} ${getFullName(p2)}`;
    }
    description += '.';
    return description;
}

const findGenericPath = (person1: Person, person2: Person, allPeople: Person[]) => {
    const queue: { personId: string; path: Person[] }[] = [];
    const visited = new Set<string>();

    queue.push({ personId: person1.id, path: [person1] });
    visited.add(person1.id);

    while (queue.length > 0) {
        const { personId, path } = queue.shift()!;
        const currentPerson = path[path.length - 1];

        if (personId === person2.id) {
            const description = generatePathDescription(path);
            return { type: 'path' as const, description, path };
        }

        const neighbors: string[] = [
            ...(currentPerson.parentIds || []),
            ...(currentPerson.childrenIds || []),
            ...(currentPerson.marriages || []).map(m => m.spouseId)
        ];
        
        for (const neighborId of neighbors) {
            if (!visited.has(neighborId)) {
                visited.add(neighborId);
                const neighborPerson = getPersonById(neighborId, allPeople);
                if (neighborPerson) {
                    const newPath = [...path, neighborPerson];
                    queue.push({ personId: neighborId, path: newPath });
                }
            }
        }
    }
    return null; // No path found
}


export type Relationship = 
    | { type: 'blood', description: string, path1: Person[], path2: Person[], lca: Person }
    | { type: 'path', description: string, path: Person[] }
    | { type: 'none', description: string };

export const findRelationship = (person1Id: string, person2Id: string, allPeople: Person[]): Relationship | null => {
    if (!person1Id || !person2Id || person1Id === person2Id) {
        return null;
    }
    
    const person1 = getPersonById(person1Id, allPeople);
    const person2 = getPersonById(person2Id, allPeople);
    if (!person1 || !person2) return null;

    // A. Check for marriage first for performance and clarity
    if (person1.marriages?.some(m => m.spouseId === person2Id)) {
        const relation = person2.gender === Gender.Male ? 'Husband' : person2.gender === Gender.Female ? 'Wife' : 'Spouse';
        return { type: 'path', description: relation, path: [person1, person2] };
    }

    // B. Check for blood relationship
    const lcaResult = findLcaAndPaths(person1Id, person2Id, allPeople);
    if (lcaResult) {
        const { lca, path1, path2 } = lcaResult;
        const description = describeBloodRelationship(person1, person2, lca, path1, path2);
        return { type: 'blood', description, path1, path2, lca };
    }

    // C. Check for in-law relationship (married to a blood relative)
    for (const marriage of person2.marriages || []) {
        const spouseOfPerson2 = getPersonById(marriage.spouseId, allPeople);
        if (spouseOfPerson2) {
            // Check if person2's spouse is a blood relative of person1
            const bloodResult = findLcaAndPaths(person1Id, spouseOfPerson2.id, allPeople);
            if (bloodResult && bloodResult.lca.id === person1Id) { // spouse is a descendant
                const generation = bloodResult.path2.length - 1; // path2 is from spouse to LCA (person1)
                let desc = '';
                if (person2.gender === Gender.Female) { // person2 is a daughter-in-law type
                    if (generation === 1) desc = "Son's Wife (Bahu)";
                    else if (generation === 2) desc = "Grandson's Wife (Bahu)";
                    else if (generation > 2) {
                        const prefix = 'Great-'.repeat(generation - 2);
                        desc = `${prefix}Grandson's Wife (Bahu)`;
                    }
                } else if (person2.gender === Gender.Male) { // person2 is a son-in-law type
                    if (generation === 1) desc = "Daughter's Husband (Damad)";
                    else if (generation === 2) desc = "Granddaughter's Husband (Damad)";
                    else if (generation > 2) {
                        const prefix = 'Great-'.repeat(generation - 2);
                        desc = `${prefix}Granddaughter's Husband (Damad)`;
                    }
                }
                if (desc) {
                    return { type: 'path', description: desc, path: [person1, spouseOfPerson2, person2] };
                }
            }
        }
    }

    // D. Find a more complex path if no direct blood tie
    const pathResult = findGenericPath(person1, person2, allPeople);
    if (pathResult) {
        // The description here will be a full sentence.
        return pathResult;
    }
    
    // E. If no path found at all
    return { type: 'none', description: 'No relationship path could be found.' };
};

export const findAllRelationships = (person1Id: string, person2Id: string, allPeople: Person[]): Relationship[] => {
    const relationships: Relationship[] = [];
    const person1 = getPersonById(person1Id, allPeople);
    const person2 = getPersonById(person2Id, allPeople);

    if (!person1 || !person2 || person1Id === person2Id) return [];

    const addRelationship = (rel: Relationship) => {
        if (rel.type !== 'none' && !relationships.some(r => r.description === rel.description)) {
            relationships.push(rel);
        }
    };

    // 1. Find the primary relationship using the existing function.
    const primaryRel = findRelationship(person1Id, person2Id, allPeople);
    if (primaryRel) {
        addRelationship(primaryRel);
    }

    // 2. Find alternative paths through marriage.
    // Check if person2 is married to any blood relative of person1.
    const p1BloodRelatives = getAllBloodRelativesIds(person1, allPeople);
    for (const relativeId of p1BloodRelatives) {
        const bloodRelative = getPersonById(relativeId, allPeople);
        // Ensure the blood relative is not person1 and is married to person2
        if (bloodRelative && bloodRelative.id !== person1Id && bloodRelative.marriages?.some(m => m.spouseId === person2Id)) {
            // person2 is married to bloodRelative. Find relation of bloodRelative to person1
            const relToBloodRelative = findRelationship(person1Id, bloodRelative.id, allPeople);
            if (relToBloodRelative && relToBloodRelative.type !== 'none') {
                const inLawDescription = `${relToBloodRelative.description}'s ${person2.gender === Gender.Male ? 'Husband' : 'Wife'}`;
                // Reconstruct the path for visualization
                let path: Person[] = [];
                if (relToBloodRelative.type === 'blood') {
                     path = [...relToBloodRelative.path1.slice(0, -1), ...relToBloodRelative.path2.reverse(), person2];
                } else {
                     path = [...relToBloodRelative.path, person2];
                }
                
                if (path.length > 0) {
                     addRelationship({ type: 'path', description: inLawDescription, path });
                }
            }
        }
    }
    
    if (relationships.length === 0) {
        return [{ type: 'none', description: 'No relationship path could be found.' }];
    }

    // Sort by path length to show most direct relationships first
    relationships.sort((a, b) => {
        const getLen = (r: Relationship): number => {
            if (r.type === 'blood') {
                return r.path1.length + r.path2.length - 2;
            } else if (r.type === 'path') {
                return r.path.length - 1;
            }
            return Infinity; // Should not be reached
        };
        return getLen(a) - getLen(b);
    });

    return relationships;
};
