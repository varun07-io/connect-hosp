// Curated list of major Indian cities/towns across every state & UT, for the
// city search autosuggest. This is intentionally broader than the pilot
// catalogue (Section 8.2 of the scope doc) — patients should be able to
// search any Indian city; ones with no hospitals yet just show an empty
// state rather than failing to suggest at all.
export const INDIAN_CITIES: string[] = [
  // Karnataka (pilot state) first, since these are where real listings exist.
  "Bengaluru", "Mysuru", "Hubballi", "Mangaluru", "Belagavi", "Kalaburagi",
  "Davanagere", "Ballari", "Shivamogga", "Tumakuru", "Udupi", "Vijayapura",
  "Hassan", "Mandya", "Chikkamagaluru", "Bidar", "Raichur", "Kolar",

  // Andhra Pradesh
  "Visakhapatnam", "Vijayawada", "Guntur", "Nellore", "Kurnool", "Tirupati",
  "Kadapa", "Kakinada", "Rajahmundry", "Anantapur",
  // Arunachal Pradesh
  "Itanagar",
  // Assam
  "Guwahati", "Silchar", "Dibrugarh", "Jorhat", "Nagaon",
  // Bihar
  "Patna", "Gaya", "Bhagalpur", "Muzaffarpur", "Darbhanga", "Purnia",
  // Chhattisgarh
  "Raipur", "Bhilai", "Bilaspur", "Korba", "Durg",
  // Goa
  "Panaji", "Margao", "Vasco da Gama",
  // Gujarat
  "Ahmedabad", "Surat", "Vadodara", "Rajkot", "Bhavnagar", "Jamnagar",
  "Gandhinagar", "Junagadh", "Anand",
  // Haryana
  "Faridabad", "Gurugram", "Panipat", "Ambala", "Karnal", "Hisar", "Rohtak",
  "Yamunanagar",
  // Himachal Pradesh
  "Shimla", "Dharamshala", "Solan", "Mandi",
  // Jharkhand
  "Ranchi", "Jamshedpur", "Dhanbad", "Bokaro", "Hazaribagh",
  // Kerala
  "Thiruvananthapuram", "Kochi", "Kozhikode", "Thrissur", "Kollam", "Kannur",
  "Alappuzha", "Palakkad", "Malappuram", "Kottayam",
  // Madhya Pradesh
  "Bhopal", "Indore", "Jabalpur", "Gwalior", "Ujjain", "Sagar", "Dewas",
  "Satna", "Ratlam",
  // Maharashtra
  "Mumbai", "Pune", "Nagpur", "Nashik", "Thane", "Chhatrapati Sambhajinagar",
  "Solapur", "Amravati", "Kolhapur", "Navi Mumbai", "Sangli", "Akola",
  "Jalgaon", "Latur", "Nanded",
  // Manipur
  "Imphal",
  // Meghalaya
  "Shillong",
  // Mizoram
  "Aizawl",
  // Nagaland
  "Kohima", "Dimapur",
  // Odisha
  "Bhubaneswar", "Cuttack", "Rourkela", "Berhampur", "Sambalpur", "Puri",
  // Punjab
  "Ludhiana", "Amritsar", "Jalandhar", "Patiala", "Bathinda", "Mohali",
  "Pathankot",
  // Rajasthan
  "Jaipur", "Jodhpur", "Udaipur", "Kota", "Bikaner", "Ajmer", "Alwar",
  "Bhilwara", "Sikar",
  // Sikkim
  "Gangtok",
  // Tamil Nadu
  "Chennai", "Coimbatore", "Madurai", "Tiruchirappalli", "Salem",
  "Tirunelveli", "Erode", "Vellore", "Thoothukudi", "Thanjavur",
  // Telangana
  "Hyderabad", "Warangal", "Nizamabad", "Karimnagar", "Khammam",
  // Tripura
  "Agartala",
  // Uttar Pradesh
  "Lucknow", "Kanpur", "Ghaziabad", "Agra", "Varanasi", "Meerut",
  "Prayagraj", "Bareilly", "Aligarh", "Moradabad", "Saharanpur", "Gorakhpur",
  "Noida", "Firozabad", "Jhansi",
  // Uttarakhand
  "Dehradun", "Haridwar", "Roorkee", "Haldwani", "Nainital",
  // West Bengal
  "Kolkata", "Howrah", "Durgapur", "Asansol", "Siliguri", "Kharagpur",
  "Malda",
  // Union Territories
  "Delhi", "New Delhi", "Chandigarh", "Puducherry", "Jammu", "Srinagar",
  "Leh", "Port Blair",
];
