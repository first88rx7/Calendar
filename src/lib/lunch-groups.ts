import type { CalendarEvent, Person } from "@/lib/types";

export function personLunchGroup(person: Person) {
  const value = (person.lunchGroup || "").trim();
  return value || person.id;
}

export function lunchGroupMembers(people: Person[], groupId: string) {
  return people.filter((person) => personLunchGroup(person) === groupId);
}

export function lunchGroupLabel(people: Person[], groupId: string) {
  const names = lunchGroupMembers(people, groupId)
    .map((person) => person.name.trim() || "Person")
    .filter(Boolean);
  if (names.length === 0) return "School menus";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export function listLunchGroups(people: Person[]) {
  const seen = new Set<string>();
  const groups: { id: string; label: string; personIds: string[] }[] = [];
  for (const person of people) {
    const id = personLunchGroup(person);
    if (seen.has(id)) continue;
    seen.add(id);
    const members = lunchGroupMembers(people, id);
    groups.push({
      id,
      label: lunchGroupLabel(people, id),
      personIds: members.map((member) => member.id),
    });
  }
  return groups;
}

export function lunchShareValue(person: Person, people: Person[]) {
  const group = personLunchGroup(person);
  const members = lunchGroupMembers(people, group);
  if (members.length <= 1) return "__own__";
  const other = members.find((item) => item.id !== person.id);
  if (people.some((item) => item.id === group) && group !== person.id) return group;
  return other?.id || "__own__";
}

export function leaveLunchGroup(people: Person[], personId: string): Person[] {
  const person = people.find((item) => item.id === personId);
  if (!person) return people;
  const oldGroup = personLunchGroup(person);
  const remaining = people.filter(
    (item) => item.id !== personId && personLunchGroup(item) === oldGroup,
  );
  const nextGroup = remaining.length > 0 && oldGroup === personId ? remaining[0].id : oldGroup;
  return people.map((item) => {
    if (item.id === personId) return { ...item, lunchGroup: personId };
    if (oldGroup === personId && remaining.some((member) => member.id === item.id)) {
      return { ...item, lunchGroup: nextGroup };
    }
    return item;
  });
}

export function setLunchShare(people: Person[], personId: string, shareWithId: string): Person[] {
  const person = people.find((item) => item.id === personId);
  if (!person) return people;
  if (!shareWithId || shareWithId === "__own__" || shareWithId === personId) {
    return leaveLunchGroup(people, personId);
  }
  const target = people.find((item) => item.id === shareWithId);
  if (!target) return people;
  const groupId = personLunchGroup(target);
  return people.map((item) => {
    if (item.id === personId || item.id === target.id) {
      return { ...item, lunchGroup: groupId };
    }
    return item;
  });
}

export function normalizePeople(people: Person[]): Person[] {
  return people.map((person, index) => {
    const id = String(person.id || "").trim() || `person-${index + 1}`;
    const calendarId = String(person.calendarId || "");
    return {
      id,
      name: String(person.name || "").trim() || `Person ${index + 1}`,
      color: String(person.color || "#3B6FDB"),
      calendarId: calendarId.startsWith("mock:") ? "" : calendarId,
      lunchGroup: personLunchGroup({ ...person, id }),
    };
  });
}

export function personOrderIndex(people: Person[], personId?: string) {
  if (!personId) return 1000;
  const index = people.findIndex((person) => person.id === personId);
  return index < 0 ? 1000 : index;
}

export function calendarOrderIndex(people: Person[], calendarId: string) {
  const index = people.findIndex((person) => person.calendarId && person.calendarId === calendarId);
  return index < 0 ? 1000 : index;
}

export function sortEventsByPeople(events: CalendarEvent[], people: Person[]) {
  return [...events].sort((a, b) => {
    const order = calendarOrderIndex(people, a.calendarId) - calendarOrderIndex(people, b.calendarId);
    if (order !== 0) return order;
    return a.startIso.localeCompare(b.startIso) || a.title.localeCompare(b.title);
  });
}
