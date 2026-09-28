/** Three local squads for ?demo=1. No images, so the page makes no network requests. */

function money(m) {
  if (m == null) return { value: null, valueText: "\u2014" };
  return { value: Math.round(m * 1e6), valueText: `\u20ac${m.toFixed(2)}m` };
}

function club(meta, rows) {
  return {
    id: meta.id,
    clubId: meta.clubId,
    name: meta.name,
    season: 2014,
    seasonLabel: "14/15",
    crest: null,
    url: `demo://${meta.clubId}`,
    coach: { id: meta.coachId, name: meta.coach, image: null },
    players: rows.map((r) => {
      const v = money(r[5]);
      return {
        id: `${meta.clubId}-${r[0]}`,
        name: r[1],
        position: r[2],
        group: r[3],
        number: String(r[4]),
        value: v.value,
        valueText: v.valueText,
        image: null,
        age: null,
        nationality: null,
      };
    }),
  };
}

const BARCA = [
  ["1", "Marc-Andre ter Stegen", "Goalkeeper", "GK", 1, 15],
  ["13", "Claudio Bravo", "Goalkeeper", "GK", 13, 8],
  ["25", "Jordi Masip", "Goalkeeper", "GK", 25, null],
  ["22", "Dani Alves", "Right-Back", "DEF", 22, 12],
  ["3", "Gerard Pique", "Centre-Back", "DEF", 3, 30],
  ["14", "Javier Mascherano", "Centre-Back", "DEF", 14, 18],
  ["18", "Jordi Alba", "Left-Back", "DEF", 18, 28],
  ["24", "Jeremy Mathieu", "Centre-Back", "DEF", 24, 8],
  ["15", "Marc Bartra", "Centre-Back", "DEF", 15, 10],
  ["21", "Adriano", "Left-Back", "DEF", 21, 3],
  ["2", "Douglas", "Right-Back", "DEF", 2, 2],
  ["5", "Sergio Busquets", "Defensive Midfield", "MID", 5, 40],
  ["4", "Ivan Rakitic", "Central Midfield", "MID", 4, 35],
  ["8", "Andres Iniesta", "Central Midfield", "MID", 8, 30],
  ["6", "Xavi", "Central Midfield", "MID", 6, 10],
  ["12", "Rafinha", "Central Midfield", "MID", 12, 15],
  ["20", "Sergi Roberto", "Right Midfield", "MID", 20, 8],
  ["26", "Sergi Samper", "Defensive Midfield", "MID", 26, 2],
  ["28", "Alen Halilovic", "Attacking Midfield", "MID", 28, 6],
  ["10", "Lionel Messi", "Right Winger", "FWD", 10, 120],
  ["9", "Luis Suarez", "Centre-Forward", "FWD", 9, 80],
  ["11", "Neymar", "Left Winger", "FWD", 11, 70],
  ["7", "Pedro", "Left Winger", "FWD", 7, 25],
  ["17", "Munir", "Centre-Forward", "FWD", 17, 8],
  ["19", "Sandro Ramirez", "Centre-Forward", "FWD", 19, 10],
];

const MADRID = [
  ["1", "Iker Casillas", "Goalkeeper", "GK", 1, 8],
  ["25", "Keylor Navas", "Goalkeeper", "GK", 25, 18],
  ["13", "Kiko Casilla", "Goalkeeper", "GK", 13, 2],
  ["4", "Sergio Ramos", "Centre-Back", "DEF", 4, 40],
  ["3", "Pepe", "Centre-Back", "DEF", 3, 12],
  ["2", "Raphael Varane", "Centre-Back", "DEF", 2, 30],
  ["12", "Marcelo", "Left-Back", "DEF", 12, 35],
  ["15", "Dani Carvajal", "Right-Back", "DEF", 15, 20],
  ["23", "Fabio Coentrao", "Left-Back", "DEF", 23, 6],
  ["17", "Alvaro Arbeloa", "Right-Back", "DEF", 17, 2],
  ["6", "Nacho", "Centre-Back", "DEF", 6, 8],
  ["19", "Luka Modric", "Central Midfield", "MID", 19, 45],
  ["8", "Toni Kroos", "Central Midfield", "MID", 8, 50],
  ["10", "James Rodriguez", "Attacking Midfield", "MID", 10, 45],
  ["22", "Isco", "Attacking Midfield", "MID", 22, 30],
  ["14", "Casemiro", "Defensive Midfield", "MID", 14, 18],
  ["24", "Asier Illarramendi", "Defensive Midfield", "MID", 24, 10],
  ["16", "Lucas Silva", "Central Midfield", "MID", 16, 8],
  ["5", "Sami Khedira", "Defensive Midfield", "MID", 5, 0],
  ["7", "Cristiano Ronaldo", "Left Winger", "FWD", 7, 120],
  ["11", "Gareth Bale", "Right Winger", "FWD", 11, 80],
  ["9", "Karim Benzema", "Centre-Forward", "FWD", 9, 45],
  ["20", "Jese", "Right Winger", "FWD", 20, 12],
  ["18", "Javier Hernandez", "Centre-Forward", "FWD", 18, 10],
  ["27", "Lucas Vazquez", "Right Winger", "FWD", 27, 4],
];

const BAYERN = [
  ["1", "Manuel Neuer", "Goalkeeper", "GK", 1, 45],
  ["23", "Pepe Reina", "Goalkeeper", "GK", 23, 4],
  ["32", "Tom Starke", "Goalkeeper", "GK", 32, 0.5],
  ["17", "Jerome Boateng", "Centre-Back", "DEF", 17, 35],
  ["5", "Medhi Benatia", "Centre-Back", "DEF", 5, 28],
  ["27", "David Alaba", "Left-Back", "DEF", 27, 40],
  ["21", "Philipp Lahm", "Right-Back", "DEF", 21, 18],
  ["18", "Juan Bernat", "Left-Back", "DEF", 18, 15],
  ["4", "Dante", "Centre-Back", "DEF", 4, 8],
  ["13", "Rafinha", "Right-Back", "DEF", 13, 8],
  ["28", "Holger Badstuber", "Centre-Back", "DEF", 28, 5],
  ["14", "Xabi Alonso", "Defensive Midfield", "MID", 14, 12],
  ["31", "Bastian Schweinsteiger", "Central Midfield", "MID", 31, 22],
  ["6", "Thiago", "Central Midfield", "MID", 6, 40],
  ["19", "Mario Gotze", "Attacking Midfield", "MID", 19, 35],
  ["25", "Thomas Muller", "Attacking Midfield", "MID", 25, 55],
  ["20", "Sebastian Rode", "Central Midfield", "MID", 20, 8],
  ["22", "Gianluca Gaudino", "Central Midfield", "MID", 22, 3],
  ["34", "Pierre-Emile Hojbjerg", "Defensive Midfield", "MID", 34, 8],
  ["9", "Robert Lewandowski", "Centre-Forward", "FWD", 9, 50],
  ["10", "Arjen Robben", "Right Winger", "FWD", 10, 35],
  ["7", "Franck Ribery", "Left Winger", "FWD", 7, 28],
  ["11", "Douglas Costa", "Left Winger", "FWD", 11, 30],
  ["8", "Xherdan Shaqiri", "Right Winger", "FWD", 8, 18],
  ["26", "Mitchell Weiser", "Right Winger", "FWD", 26, 2],
];

export function demoTeams() {
  return [
    club({ id: "131-2014", clubId: "131", name: "FC Barcelona", coachId: "67", coach: "Luis Enrique" }, BARCA),
    club({ id: "418-2014", clubId: "418", name: "Real Madrid", coachId: "523", coach: "Carlo Ancelotti" }, MADRID),
    club({ id: "27-2014", clubId: "27", name: "Bayern Munich", coachId: "5672", coach: "Pep Guardiola" }, BAYERN),
  ];
}
