// Major cities and logistics hubs across Africa for trip origin/destination
// suggestions. Grouped by region for maintainability; rendered flat.

const EAST_AFRICA = [
  // Tanzania
  "Dar es Salaam, Tanzania", "Dodoma, Tanzania", "Mwanza, Tanzania", "Arusha, Tanzania",
  "Mbeya, Tanzania", "Morogoro, Tanzania", "Tanga, Tanzania", "Kigoma, Tanzania",
  "Moshi, Tanzania", "Iringa, Tanzania", "Singida, Tanzania", "Tabora, Tanzania",
  "Songea, Tanzania", "Mtwara, Tanzania", "Musoma, Tanzania", "Shinyanga, Tanzania",
  "Sumbawanga, Tanzania", "Tunduma, Tanzania", "Zanzibar City, Tanzania",
  // Kenya
  "Nairobi, Kenya", "Mombasa, Kenya", "Kisumu, Kenya", "Nakuru, Kenya",
  "Eldoret, Kenya", "Malaba, Kenya", "Namanga, Kenya", "Voi, Kenya",
  // Uganda
  "Kampala, Uganda", "Entebbe, Uganda", "Jinja, Uganda", "Gulu, Uganda",
  "Mbarara, Uganda", "Busia, Uganda",
  // Rwanda / Burundi
  "Kigali, Rwanda", "Butare, Rwanda", "Rusumo, Rwanda",
  "Bujumbura, Burundi", "Gitega, Burundi",
  // Ethiopia / Somalia / Djibouti / Eritrea
  "Addis Ababa, Ethiopia", "Dire Dawa, Ethiopia", "Mekelle, Ethiopia",
  "Mogadishu, Somalia", "Hargeisa, Somalia", "Djibouti City, Djibouti", "Asmara, Eritrea",
  // South Sudan / Sudan
  "Juba, South Sudan", "Khartoum, Sudan", "Port Sudan, Sudan",
];

const SOUTHERN_AFRICA = [
  // Zambia
  "Lusaka, Zambia", "Ndola, Zambia", "Kitwe, Zambia", "Kapiri Mposhi, Zambia",
  "Livingstone, Zambia", "Chipata, Zambia", "Nakonde, Zambia",
  // Malawi / Mozambique / Zimbabwe
  "Lilongwe, Malawi", "Blantyre, Malawi", "Mzuzu, Malawi",
  "Maputo, Mozambique", "Beira, Mozambique", "Nampula, Mozambique", "Nacala, Mozambique", "Tete, Mozambique",
  "Harare, Zimbabwe", "Bulawayo, Zimbabwe", "Mutare, Zimbabwe", "Beitbridge, Zimbabwe",
  // Botswana / Namibia
  "Gaborone, Botswana", "Francistown, Botswana", "Kasane, Botswana",
  "Windhoek, Namibia", "Walvis Bay, Namibia",
  // South Africa
  "Johannesburg, South Africa", "Pretoria, South Africa", "Durban, South Africa",
  "Cape Town, South Africa", "Port Elizabeth, South Africa", "Bloemfontein, South Africa",
  "Polokwane, South Africa", "Musina, South Africa",
  // Angola / Lesotho / Eswatini / Madagascar / Mauritius / Comoros / Seychelles
  "Luanda, Angola", "Lobito, Angola", "Lubango, Angola",
  "Maseru, Lesotho", "Mbabane, Eswatini",
  "Antananarivo, Madagascar", "Toamasina, Madagascar",
  "Port Louis, Mauritius", "Moroni, Comoros", "Victoria, Seychelles",
];

const CENTRAL_AFRICA = [
  "Kinshasa, DR Congo", "Lubumbashi, DR Congo", "Goma, DR Congo",
  "Kolwezi, DR Congo", "Bukavu, DR Congo", "Kisangani, DR Congo", "Matadi, DR Congo",
  "Brazzaville, Congo", "Pointe-Noire, Congo",
  "Yaoundé, Cameroon", "Douala, Cameroon",
  "Bangui, Central African Republic", "N'Djamena, Chad",
  "Libreville, Gabon", "Malabo, Equatorial Guinea", "São Tomé, São Tomé and Príncipe",
];

const WEST_AFRICA = [
  "Lagos, Nigeria", "Abuja, Nigeria", "Kano, Nigeria", "Port Harcourt, Nigeria", "Ibadan, Nigeria",
  "Accra, Ghana", "Kumasi, Ghana", "Tema, Ghana",
  "Abidjan, Côte d'Ivoire", "Yamoussoukro, Côte d'Ivoire",
  "Dakar, Senegal", "Bamako, Mali", "Ouagadougou, Burkina Faso",
  "Niamey, Niger", "Conakry, Guinea", "Freetown, Sierra Leone",
  "Monrovia, Liberia", "Lomé, Togo", "Cotonou, Benin",
  "Banjul, Gambia", "Bissau, Guinea-Bissau", "Nouakchott, Mauritania", "Praia, Cape Verde",
];

const NORTH_AFRICA = [
  "Cairo, Egypt", "Alexandria, Egypt", "Giza, Egypt",
  "Tripoli, Libya", "Benghazi, Libya",
  "Tunis, Tunisia", "Sfax, Tunisia",
  "Algiers, Algeria", "Oran, Algeria",
  "Casablanca, Morocco", "Rabat, Morocco", "Tangier, Morocco", "Marrakesh, Morocco",
];

export const AFRICAN_CITIES: string[] = [
  ...EAST_AFRICA,
  ...SOUTHERN_AFRICA,
  ...CENTRAL_AFRICA,
  ...WEST_AFRICA,
  ...NORTH_AFRICA,
];
