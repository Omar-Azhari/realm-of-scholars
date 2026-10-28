/**
 * Curated directory for the enrolment picker: country -> city -> universities.
 * Not exhaustive — every picker also accepts a typed-in value, so a student
 * at any institution can enrol. Names are each university's common official
 * English name.
 */

export interface CityEntry {
  city: string;
  universities: string[];
}

export interface CountryEntry {
  country: string;
  teachingPeriods: string[];
  cities: CityEntry[];
}

const SEMESTERS = ["Semester 1", "Semester 2", "Summer Semester", "Winter Semester"];
const US_TERMS = ["Fall Semester", "Spring Semester", "Summer Session", "Fall Quarter", "Winter Quarter", "Spring Quarter"];
const UK_TERMS = ["Autumn Term", "Spring Term", "Summer Term", "Semester 1", "Semester 2"];

export const UNIVERSITY_DIRECTORY: CountryEntry[] = [
  {
    country: "Australia",
    teachingPeriods: ["Semester 1", "Semester 2", "Trimester 1", "Trimester 2", "Trimester 3", "Summer Semester", "Winter Semester"],
    cities: [
      { city: "Melbourne", universities: ["La Trobe University", "University of Melbourne", "Monash University", "RMIT University", "Deakin University", "Swinburne University of Technology", "Victoria University", "Australian Catholic University"] },
      { city: "Sydney", universities: ["University of Sydney", "UNSW Sydney", "University of Technology Sydney", "Macquarie University", "Western Sydney University", "La Trobe University"] },
      { city: "Brisbane", universities: ["University of Queensland", "Queensland University of Technology", "Griffith University"] },
      { city: "Adelaide", universities: ["Adelaide University", "Flinders University"] },
      { city: "Perth", universities: ["University of Western Australia", "Curtin University", "Edith Cowan University", "Murdoch University"] },
      { city: "Canberra", universities: ["Australian National University", "University of Canberra"] },
      { city: "Hobart", universities: ["University of Tasmania"] },
      { city: "Gold Coast", universities: ["Bond University", "Griffith University"] },
      { city: "Wollongong", universities: ["University of Wollongong"] },
      { city: "Newcastle", universities: ["University of Newcastle"] },
      { city: "Bendigo", universities: ["La Trobe University"] },
      { city: "Albury-Wodonga", universities: ["La Trobe University", "Charles Sturt University"] },
      { city: "Mildura", universities: ["La Trobe University"] },
      { city: "Shepparton", universities: ["La Trobe University"] },
    ],
  },
  {
    country: "New Zealand",
    teachingPeriods: ["Semester 1", "Semester 2", "Summer School", "Trimester 1", "Trimester 2"],
    cities: [
      { city: "Auckland", universities: ["University of Auckland", "Auckland University of Technology"] },
      { city: "Wellington", universities: ["Victoria University of Wellington"] },
      { city: "Christchurch", universities: ["University of Canterbury"] },
      { city: "Dunedin", universities: ["University of Otago"] },
      { city: "Hamilton", universities: ["University of Waikato"] },
      { city: "Palmerston North", universities: ["Massey University"] },
    ],
  },
  {
    country: "United Kingdom",
    teachingPeriods: UK_TERMS,
    cities: [
      { city: "London", universities: ["Imperial College London", "University College London", "King's College London", "London School of Economics and Political Science", "Queen Mary University of London", "City St George's, University of London", "University of Westminster", "Brunel University of London"] },
      { city: "Oxford", universities: ["University of Oxford", "Oxford Brookes University"] },
      { city: "Cambridge", universities: ["University of Cambridge", "Anglia Ruskin University"] },
      { city: "Manchester", universities: ["University of Manchester", "Manchester Metropolitan University"] },
      { city: "Edinburgh", universities: ["University of Edinburgh", "Heriot-Watt University", "Edinburgh Napier University"] },
      { city: "Glasgow", universities: ["University of Glasgow", "University of Strathclyde", "Glasgow Caledonian University"] },
      { city: "Birmingham", universities: ["University of Birmingham", "Aston University", "Birmingham City University"] },
      { city: "Leeds", universities: ["University of Leeds", "Leeds Beckett University"] },
      { city: "Bristol", universities: ["University of Bristol", "University of the West of England"] },
      { city: "Cardiff", universities: ["Cardiff University", "Cardiff Metropolitan University"] },
      { city: "Belfast", universities: ["Queen's University Belfast", "Ulster University"] },
      { city: "Nottingham", universities: ["University of Nottingham", "Nottingham Trent University"] },
      { city: "Sheffield", universities: ["University of Sheffield", "Sheffield Hallam University"] },
      { city: "Liverpool", universities: ["University of Liverpool", "Liverpool John Moores University"] },
      { city: "Warwick / Coventry", universities: ["University of Warwick", "Coventry University"] },
    ],
  },
  {
    country: "Ireland",
    teachingPeriods: ["Semester 1", "Semester 2", "Summer Term"],
    cities: [
      { city: "Dublin", universities: ["Trinity College Dublin", "University College Dublin", "Dublin City University", "Technological University Dublin"] },
      { city: "Cork", universities: ["University College Cork", "Munster Technological University"] },
      { city: "Galway", universities: ["University of Galway"] },
      { city: "Limerick", universities: ["University of Limerick"] },
      { city: "Maynooth", universities: ["Maynooth University"] },
    ],
  },
  {
    country: "United States",
    teachingPeriods: US_TERMS,
    cities: [
      { city: "Boston / Cambridge, MA", universities: ["Harvard University", "Massachusetts Institute of Technology", "Boston University", "Northeastern University", "Boston College", "Tufts University"] },
      { city: "New York City", universities: ["Columbia University", "New York University", "City University of New York", "Fordham University", "The New School"] },
      { city: "Los Angeles", universities: ["University of California, Los Angeles", "University of Southern California", "California State University, Los Angeles", "Loyola Marymount University"] },
      { city: "San Francisco Bay Area", universities: ["Stanford University", "University of California, Berkeley", "San José State University", "San Francisco State University", "Santa Clara University"] },
      { city: "Chicago", universities: ["University of Chicago", "Northwestern University", "University of Illinois Chicago", "Loyola University Chicago", "DePaul University"] },
      { city: "Philadelphia", universities: ["University of Pennsylvania", "Drexel University", "Temple University"] },
      { city: "Washington, D.C.", universities: ["Georgetown University", "George Washington University", "American University", "Howard University"] },
      { city: "Seattle", universities: ["University of Washington", "Seattle University"] },
      { city: "Austin", universities: ["University of Texas at Austin", "St. Edward's University"] },
      { city: "Atlanta", universities: ["Georgia Institute of Technology", "Emory University", "Georgia State University"] },
      { city: "Ann Arbor", universities: ["University of Michigan"] },
      { city: "Pittsburgh", universities: ["Carnegie Mellon University", "University of Pittsburgh"] },
      { city: "Princeton", universities: ["Princeton University"] },
      { city: "New Haven", universities: ["Yale University"] },
      { city: "Ithaca", universities: ["Cornell University", "Ithaca College"] },
      { city: "Pasadena", universities: ["California Institute of Technology"] },
      { city: "Madison", universities: ["University of Wisconsin–Madison"] },
      { city: "Champaign–Urbana", universities: ["University of Illinois Urbana-Champaign"] },
      { city: "San Diego", universities: ["University of California, San Diego", "San Diego State University"] },
      { city: "Miami", universities: ["University of Miami", "Florida International University"] },
    ],
  },
  {
    country: "Canada",
    teachingPeriods: ["Fall Term", "Winter Term", "Summer Term"],
    cities: [
      { city: "Toronto", universities: ["University of Toronto", "Toronto Metropolitan University", "York University", "OCAD University"] },
      { city: "Montreal", universities: ["McGill University", "Concordia University", "Université de Montréal", "Université du Québec à Montréal"] },
      { city: "Vancouver", universities: ["University of British Columbia", "Simon Fraser University", "Emily Carr University of Art + Design"] },
      { city: "Ottawa", universities: ["University of Ottawa", "Carleton University"] },
      { city: "Waterloo", universities: ["University of Waterloo", "Wilfrid Laurier University"] },
      { city: "Calgary", universities: ["University of Calgary", "Mount Royal University"] },
      { city: "Edmonton", universities: ["University of Alberta", "MacEwan University"] },
      { city: "Kingston", universities: ["Queen's University"] },
      { city: "Hamilton", universities: ["McMaster University"] },
      { city: "Halifax", universities: ["Dalhousie University", "Saint Mary's University"] },
    ],
  },
  {
    country: "India",
    teachingPeriods: ["Odd Semester", "Even Semester", "Semester 1", "Semester 2"],
    cities: [
      { city: "Delhi", universities: ["Indian Institute of Technology Delhi", "University of Delhi", "Jawaharlal Nehru University", "Delhi Technological University", "Jamia Millia Islamia"] },
      { city: "Mumbai", universities: ["Indian Institute of Technology Bombay", "University of Mumbai", "Institute of Chemical Technology"] },
      { city: "Bengaluru", universities: ["Indian Institute of Science", "Christ University", "PES University", "R. V. College of Engineering"] },
      { city: "Chennai", universities: ["Indian Institute of Technology Madras", "Anna University", "University of Madras", "SRM Institute of Science and Technology"] },
      { city: "Kolkata", universities: ["Jadavpur University", "University of Calcutta", "Indian Statistical Institute"] },
      { city: "Hyderabad", universities: ["University of Hyderabad", "Indian Institute of Technology Hyderabad", "International Institute of Information Technology, Hyderabad", "Osmania University"] },
      { city: "Pune", universities: ["Savitribai Phule Pune University", "Symbiosis International University", "College of Engineering Pune"] },
      { city: "Kanpur", universities: ["Indian Institute of Technology Kanpur"] },
      { city: "Vellore", universities: ["Vellore Institute of Technology"] },
      { city: "Manipal", universities: ["Manipal Academy of Higher Education"] },
    ],
  },
  {
    country: "Singapore",
    teachingPeriods: ["Semester 1", "Semester 2", "Special Term"],
    cities: [
      { city: "Singapore", universities: ["National University of Singapore", "Nanyang Technological University", "Singapore Management University", "Singapore University of Technology and Design", "Singapore Institute of Technology"] },
    ],
  },
  {
    country: "Malaysia",
    teachingPeriods: SEMESTERS,
    cities: [
      { city: "Kuala Lumpur", universities: ["Universiti Malaya", "Asia Pacific University of Technology & Innovation", "Taylor's University", "Sunway University", "Monash University Malaysia"] },
      { city: "Selangor", universities: ["Universiti Putra Malaysia", "Universiti Kebangsaan Malaysia", "University of Nottingham Malaysia"] },
      { city: "Penang", universities: ["Universiti Sains Malaysia"] },
      { city: "Johor Bahru", universities: ["Universiti Teknologi Malaysia"] },
    ],
  },
  {
    country: "Germany",
    teachingPeriods: ["Winter Semester", "Summer Semester"],
    cities: [
      { city: "Munich", universities: ["Technical University of Munich", "Ludwig Maximilian University of Munich"] },
      { city: "Berlin", universities: ["Humboldt University of Berlin", "Free University of Berlin", "Technical University of Berlin"] },
      { city: "Heidelberg", universities: ["Heidelberg University"] },
      { city: "Aachen", universities: ["RWTH Aachen University"] },
      { city: "Hamburg", universities: ["University of Hamburg", "Hamburg University of Technology"] },
      { city: "Frankfurt", universities: ["Goethe University Frankfurt", "Frankfurt School of Finance & Management"] },
      { city: "Karlsruhe", universities: ["Karlsruhe Institute of Technology"] },
      { city: "Cologne", universities: ["University of Cologne"] },
    ],
  },
  {
    country: "France",
    teachingPeriods: ["Semestre 1 (Autumn)", "Semestre 2 (Spring)"],
    cities: [
      { city: "Paris", universities: ["Sorbonne University", "Université Paris Cité", "Université PSL", "Sciences Po", "Institut Polytechnique de Paris", "Université Paris-Saclay"] },
      { city: "Lyon", universities: ["Université Claude Bernard Lyon 1", "Université Lumière Lyon 2", "INSA Lyon"] },
      { city: "Toulouse", universities: ["Université Toulouse Capitole", "INSA Toulouse"] },
      { city: "Grenoble", universities: ["Université Grenoble Alpes"] },
      { city: "Strasbourg", universities: ["University of Strasbourg"] },
    ],
  },
  {
    country: "Netherlands",
    teachingPeriods: ["Semester 1", "Semester 2", "Period 1", "Period 2", "Period 3", "Period 4"],
    cities: [
      { city: "Amsterdam", universities: ["University of Amsterdam", "Vrije Universiteit Amsterdam"] },
      { city: "Delft", universities: ["Delft University of Technology"] },
      { city: "Leiden", universities: ["Leiden University"] },
      { city: "Utrecht", universities: ["Utrecht University"] },
      { city: "Rotterdam", universities: ["Erasmus University Rotterdam"] },
      { city: "Eindhoven", universities: ["Eindhoven University of Technology"] },
      { city: "Groningen", universities: ["University of Groningen"] },
    ],
  },
  {
    country: "Spain",
    teachingPeriods: ["First Semester", "Second Semester"],
    cities: [
      { city: "Madrid", universities: ["Complutense University of Madrid", "Autonomous University of Madrid", "Technical University of Madrid", "Carlos III University of Madrid", "IE University"] },
      { city: "Barcelona", universities: ["University of Barcelona", "Autonomous University of Barcelona", "Pompeu Fabra University", "Polytechnic University of Catalonia"] },
      { city: "Valencia", universities: ["University of Valencia", "Polytechnic University of Valencia"] },
      { city: "Seville", universities: ["University of Seville"] },
    ],
  },
  {
    country: "Italy",
    teachingPeriods: ["First Semester", "Second Semester"],
    cities: [
      { city: "Milan", universities: ["Politecnico di Milano", "University of Milan", "Bocconi University"] },
      { city: "Rome", universities: ["Sapienza University of Rome", "University of Rome Tor Vergata", "LUISS University"] },
      { city: "Bologna", universities: ["University of Bologna"] },
      { city: "Turin", universities: ["Politecnico di Torino", "University of Turin"] },
      { city: "Padua", universities: ["University of Padua"] },
    ],
  },
  {
    country: "Switzerland",
    teachingPeriods: ["Autumn Semester", "Spring Semester"],
    cities: [
      { city: "Zurich", universities: ["ETH Zurich", "University of Zurich"] },
      { city: "Lausanne", universities: ["EPFL", "University of Lausanne"] },
      { city: "Geneva", universities: ["University of Geneva"] },
      { city: "Basel", universities: ["University of Basel"] },
    ],
  },
  {
    country: "Sweden",
    teachingPeriods: ["Autumn Semester", "Spring Semester"],
    cities: [
      { city: "Stockholm", universities: ["KTH Royal Institute of Technology", "Stockholm University", "Karolinska Institutet"] },
      { city: "Lund", universities: ["Lund University"] },
      { city: "Uppsala", universities: ["Uppsala University"] },
      { city: "Gothenburg", universities: ["University of Gothenburg", "Chalmers University of Technology"] },
    ],
  },
  {
    country: "Japan",
    teachingPeriods: ["Spring Semester", "Fall Semester"],
    cities: [
      { city: "Tokyo", universities: ["University of Tokyo", "Waseda University", "Keio University", "Tokyo Institute of Science", "Sophia University"] },
      { city: "Kyoto", universities: ["Kyoto University", "Doshisha University", "Ritsumeikan University"] },
      { city: "Osaka", universities: ["Osaka University"] },
      { city: "Sendai", universities: ["Tohoku University"] },
      { city: "Nagoya", universities: ["Nagoya University"] },
    ],
  },
  {
    country: "South Korea",
    teachingPeriods: ["Spring Semester", "Fall Semester"],
    cities: [
      { city: "Seoul", universities: ["Seoul National University", "Yonsei University", "Korea University", "Sungkyunkwan University", "Hanyang University"] },
      { city: "Daejeon", universities: ["KAIST"] },
      { city: "Pohang", universities: ["POSTECH"] },
    ],
  },
  {
    country: "China",
    teachingPeriods: ["Autumn Semester", "Spring Semester"],
    cities: [
      { city: "Beijing", universities: ["Tsinghua University", "Peking University", "Renmin University of China", "Beijing Normal University"] },
      { city: "Shanghai", universities: ["Fudan University", "Shanghai Jiao Tong University", "Tongji University", "NYU Shanghai"] },
      { city: "Hangzhou", universities: ["Zhejiang University"] },
      { city: "Nanjing", universities: ["Nanjing University", "Southeast University"] },
      { city: "Hong Kong", universities: ["University of Hong Kong", "Hong Kong University of Science and Technology", "Chinese University of Hong Kong", "City University of Hong Kong", "Hong Kong Polytechnic University"] },
    ],
  },
  {
    country: "United Arab Emirates",
    teachingPeriods: ["Fall Semester", "Spring Semester", "Summer Session"],
    cities: [
      { city: "Abu Dhabi", universities: ["Khalifa University", "New York University Abu Dhabi", "United Arab Emirates University", "Mohamed bin Zayed University of Artificial Intelligence"] },
      { city: "Dubai", universities: ["University of Dubai", "Heriot-Watt University Dubai", "University of Birmingham Dubai", "American University in Dubai"] },
      { city: "Sharjah", universities: ["American University of Sharjah", "University of Sharjah"] },
    ],
  },
  {
    country: "Saudi Arabia",
    teachingPeriods: ["First Semester", "Second Semester", "Summer Semester"],
    cities: [
      { city: "Riyadh", universities: ["King Saud University", "Princess Nourah bint Abdulrahman University", "Prince Sultan University"] },
      { city: "Jeddah", universities: ["King Abdulaziz University", "Effat University"] },
      { city: "Thuwal", universities: ["King Abdullah University of Science and Technology"] },
      { city: "Dhahran", universities: ["King Fahd University of Petroleum and Minerals"] },
    ],
  },
  {
    country: "Egypt",
    teachingPeriods: ["Fall Semester", "Spring Semester", "Summer Semester"],
    cities: [
      { city: "Cairo", universities: ["Cairo University", "Ain Shams University", "The American University in Cairo", "German University in Cairo", "British University in Egypt"] },
      { city: "Alexandria", universities: ["Alexandria University", "Arab Academy for Science, Technology and Maritime Transport"] },
      { city: "Giza", universities: ["Cairo University"] },
    ],
  },
  {
    country: "South Africa",
    teachingPeriods: ["Semester 1", "Semester 2"],
    cities: [
      { city: "Cape Town", universities: ["University of Cape Town", "University of the Western Cape", "Cape Peninsula University of Technology"] },
      { city: "Johannesburg", universities: ["University of the Witwatersrand", "University of Johannesburg"] },
      { city: "Pretoria", universities: ["University of Pretoria", "University of South Africa"] },
      { city: "Stellenbosch", universities: ["Stellenbosch University"] },
      { city: "Durban", universities: ["University of KwaZulu-Natal"] },
    ],
  },
  {
    country: "Nigeria",
    teachingPeriods: ["First Semester", "Second Semester"],
    cities: [
      { city: "Lagos", universities: ["University of Lagos", "Lagos State University", "Pan-Atlantic University"] },
      { city: "Ibadan", universities: ["University of Ibadan"] },
      { city: "Zaria", universities: ["Ahmadu Bello University"] },
      { city: "Nsukka", universities: ["University of Nigeria, Nsukka"] },
    ],
  },
  {
    country: "Brazil",
    teachingPeriods: ["First Semester", "Second Semester"],
    cities: [
      { city: "São Paulo", universities: ["University of São Paulo", "Federal University of São Paulo", "Mackenzie Presbyterian University"] },
      { city: "Rio de Janeiro", universities: ["Federal University of Rio de Janeiro", "Pontifical Catholic University of Rio de Janeiro"] },
      { city: "Campinas", universities: ["University of Campinas"] },
      { city: "Belo Horizonte", universities: ["Federal University of Minas Gerais"] },
    ],
  },
  {
    country: "Mexico",
    teachingPeriods: ["Spring Semester", "Fall Semester"],
    cities: [
      { city: "Mexico City", universities: ["National Autonomous University of Mexico", "Instituto Politécnico Nacional", "Universidad Iberoamericana", "ITAM"] },
      { city: "Monterrey", universities: ["Tecnológico de Monterrey", "Universidad Autónoma de Nuevo León"] },
      { city: "Guadalajara", universities: ["University of Guadalajara"] },
    ],
  },
  {
    country: "Pakistan",
    teachingPeriods: ["Fall Semester", "Spring Semester", "Summer Semester"],
    cities: [
      { city: "Lahore", universities: ["Lahore University of Management Sciences", "University of the Punjab", "University of Engineering and Technology, Lahore"] },
      { city: "Islamabad", universities: ["National University of Sciences and Technology", "Quaid-i-Azam University", "COMSATS University Islamabad"] },
      { city: "Karachi", universities: ["University of Karachi", "Institute of Business Administration, Karachi", "Aga Khan University"] },
    ],
  },
  {
    country: "Philippines",
    teachingPeriods: ["First Semester", "Second Semester", "Midyear Term"],
    cities: [
      { city: "Manila", universities: ["University of Santo Tomas", "De La Salle University", "Mapúa University"] },
      { city: "Quezon City", universities: ["University of the Philippines Diliman", "Ateneo de Manila University"] },
    ],
  },
  {
    country: "Indonesia",
    teachingPeriods: ["Odd Semester", "Even Semester"],
    cities: [
      { city: "Jakarta / Depok", universities: ["University of Indonesia", "BINUS University"] },
      { city: "Bandung", universities: ["Bandung Institute of Technology", "Padjadjaran University"] },
      { city: "Yogyakarta", universities: ["Gadjah Mada University"] },
    ],
  },
];

export function findCountry(country: string): CountryEntry | undefined {
  return UNIVERSITY_DIRECTORY.find((c) => c.country.toLowerCase() === country.trim().toLowerCase());
}

export function citiesFor(country: string): string[] {
  return findCountry(country)?.cities.map((c) => c.city) ?? [];
}

export function universitiesFor(country: string, city: string): string[] {
  const entry = findCountry(country);
  if (!entry) return [];
  const match = entry.cities.find((c) => c.city.toLowerCase() === city.trim().toLowerCase());
  if (match) return match.universities;
  return Array.from(new Set(entry.cities.flatMap((c) => c.universities))).sort();
}

export function teachingPeriodsFor(country: string): string[] {
  return findCountry(country)?.teachingPeriods ?? SEMESTERS;
}
