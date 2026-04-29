/**
 * US AutoForce Warehouse Directory
 * 
 * Source: WarehouseList_2026.xlsx from Jennifer Fletcher
 * Last updated: July 2026
 * 
 * Notes:
 * - 4841 Cincinnati: Moved as of 3/2026
 * - 4253 Kansas City: Moved as of 4/27/2026
 * - 4413 Spokane: NEW Address as of 2/6/2026
 * - 4860 Fairfield: New Address as of 2/2/2026
 * - 4155 Springfield MO: NEW - 4/10/2026
 * - 4154 Peoria: NEW - 4/10/2026
 */

import type { USAutoForceWarehouse } from "./types";

export const USAUTOFORCE_WAREHOUSES: USAutoForceWarehouse[] = [
  // ========== MIDWEST ==========
  { code: "4101", metroArea: "Appleton", address: "2655 W Evergreen Drive", city: "Appleton", state: "WI", zip: "54913", phone: "800-490-4901" },
  { code: "4103", metroArea: "Madison", address: "4722 Helgesen Drive", city: "Madison", state: "WI", zip: "53718", phone: "800-490-4901" },
  { code: "4102", metroArea: "Milwaukee", address: "11225 W Mitchell Street", city: "West Allis", state: "WI", zip: "53214", phone: "800-490-4901" },
  { code: "4151", metroArea: "Chicago North", address: "7637 New Gross Point Road", city: "Skokie", state: "IL", zip: "60077", phone: "800-490-4901" },
  { code: "4153", metroArea: "Chicago South", address: "11939 S. Central Avenue Unit 150", city: "Alsip", state: "IL", zip: "60803", phone: "800-490-4901" },
  { code: "4152", metroArea: "Chicago West", address: "401 Gary Avenue", city: "Roselle", state: "IL", zip: "60172", phone: "800-490-4901" },
  { code: "4155", metroArea: "Springfield", address: "2925 E. Jean Street", city: "Springfield", state: "MO", zip: "65803", phone: "800-490-4901", notes: "NEW - 4/10/2026" },
  { code: "4154", metroArea: "Peoria", address: "8512 N. Allen Rd Ste 200", city: "Peoria", state: "IL", zip: "61615", phone: "800-490-4901", notes: "NEW - 4/10/2026" },
  { code: "4160", metroArea: "Detroit", address: "48238 Frank Street", city: "Wixom", state: "MI", zip: "48393", phone: "800-490-4901" },
  { code: "4170", metroArea: "Indianapolis", address: "4308 W 300 N", city: "Greenfield", state: "IN", zip: "46140", phone: "800-490-4901" },
  { code: "4175", metroArea: "Nashville", address: "413 Salyers Drive", city: "LaVergne", state: "TN", zip: "37086", phone: "800-490-4901" },
  { code: "4202", metroArea: "Minneapolis North", address: "2503 Walnut St", city: "Roseville", state: "MN", zip: "55113", phone: "800-490-4901" },
  { code: "4201", metroArea: "Minneapolis South", address: "2360 Pilot Knob Road", city: "Mendota Heights", state: "MN", zip: "55120", phone: "800-490-4901" },
  { code: "4204", metroArea: "Minneapolis West", address: "15175 25th Avenue N", city: "Plymouth", state: "MN", zip: "55447", phone: "800-490-4901" },
  { code: "4251", metroArea: "St. Louis", address: "13881 Corporate Woods Trail", city: "Bridgeton", state: "MO", zip: "63044", phone: "800-490-4901" },
  { code: "4253", metroArea: "Kansas City", address: "4700 North Arlington", city: "Kansas City", state: "MO", zip: "64161", phone: "800-490-4901", notes: "Moved as of 4/27/2026" },
  { code: "4301", metroArea: "Omaha", address: "14644 Rodina Street Suite 150", city: "Springfield", state: "NE", zip: "68059", phone: "800-490-4901" },
  { code: "4304", metroArea: "Des Moines", address: "6450 Northeast Industry Drive", city: "Des Moines", state: "IA", zip: "50313", phone: "800-490-4901" },
  { code: "4320", metroArea: "Iowa - Mixing WHS", address: "101 Council St", city: "West Branch", state: "IA", zip: "52358", phone: "800-490-4901" },
  { code: "4351", metroArea: "Sioux Falls", address: "200 S Petro Avenue", city: "Sioux Falls", state: "SD", zip: "57107", phone: "800-490-4901" },
  
  // ========== OHIO ==========
  { code: "4841", metroArea: "Cincinnati", address: "3770 Symmes Road Suite C", city: "Fairfield", state: "OH", zip: "45015", phone: "800-490-4901", notes: "Moved as of 3/2026" },
  { code: "4840", metroArea: "Cleveland", address: "8601 Independence Pkwy Suite 100", city: "Twinsburg", state: "OH", zip: "44087", phone: "800-490-4901" },
  { code: "4842", metroArea: "Columbus", address: "2315 Creekside Parkway Suite 200", city: "Lockbourne", state: "OH", zip: "43137", phone: "800-490-4901" },
  
  // ========== SOUTHEAST ==========
  { code: "4803", metroArea: "Atlanta - North", address: "3100 New McEver Road NW", city: "Acworth", state: "GA", zip: "30101", phone: "800-490-4901" },
  { code: "4801", metroArea: "Atlanta - South", address: "2832 Anvil Block Road", city: "Ellenwood", state: "GA", zip: "30294", phone: "800-490-4901" },
  { code: "4810", metroArea: "Augusta", address: "155 Twin Hills Road", city: "North Augusta", state: "SC", zip: "29860", phone: "800-490-4901" },
  { code: "4850", metroArea: "Birmingham", address: "175 Airview Lane Suite 100", city: "Alabaster", state: "AL", zip: "35007", phone: "800-490-4901" },
  { code: "4811", metroArea: "Charlotte", address: "10230 Ridge Creek Drive Suite C", city: "Charlotte", state: "NC", zip: "28273", phone: "800-490-4901" },
  { code: "4812", metroArea: "Raleigh", address: "875 Gateway Drive, Suite 110", city: "Apex", state: "NC", zip: "27523", phone: "800-490-4901" },
  { code: "4820", metroArea: "Tallahassee", address: "695 Commerce Boulevard", city: "Midway", state: "FL", zip: "32343", phone: "800-490-4901" },
  
  // ========== FLORIDA ==========
  { code: "4451", metroArea: "Miami", address: "4280 W. 104th Street", city: "Hialeah", state: "FL", zip: "33018", phone: "800-490-4901" },
  { code: "4453", metroArea: "Fort Lauderdale", address: "2200 W Sunrise Blvd Suite 160", city: "Fort Lauderdale", state: "FL", zip: "33311", phone: "800-490-4901" },
  { code: "4456", metroArea: "Fort Myers", address: "16523 Airport Haul Rd", city: "Fort Myers", state: "FL", zip: "33913", phone: "800-490-4901" },
  { code: "4455", metroArea: "Jacksonville", address: "6040 Imeson Rd Suite 400", city: "Jacksonville", state: "FL", zip: "32219", phone: "800-490-4901" },
  { code: "4454", metroArea: "Orlando", address: "8034 Horizon Park Drive Suite 100", city: "Orlando", state: "FL", zip: "32809", phone: "800-490-4901" },
  { code: "4452", metroArea: "Tampa", address: "9230 E Columbus Drive Suite 101", city: "Tampa", state: "FL", zip: "33619", phone: "800-490-4901" },
  
  // ========== TEXAS ==========
  { code: "4506", metroArea: "Austin", address: "8500 East Parmer Lane", city: "Manor", state: "TX", zip: "78653", phone: "800-490-4901" },
  { code: "4505", metroArea: "Dallas - Ft Worth", address: "13330 Senlac Drive", city: "Farmers Branch", state: "TX", zip: "75234", phone: "800-490-4901" },
  { code: "4507", metroArea: "Fort Worth", address: "7650 Winbrook Dr Ste 102", city: "Benbrook", state: "TX", zip: "76126", phone: "800-490-4901" },
  { code: "4502", metroArea: "Houston", address: "6410 Langfield Building H", city: "Houston", state: "TX", zip: "77092", phone: "800-490-4901" },
  { code: "4501", metroArea: "San Antonio", address: "5007 Eisenhauer Road Suite 110", city: "San Antonio", state: "TX", zip: "78218", phone: "800-490-4901" },
  
  // ========== COLORADO ==========
  { code: "4402", metroArea: "Colorado Springs", address: "2570 Zepplein Road", city: "Colorado Springs", state: "CO", zip: "80916", phone: "800-490-4901" },
  { code: "4401", metroArea: "Denver", address: "5675 Pecos Street Building 3", city: "Denver", state: "CO", zip: "80221", phone: "800-490-4901" },
  { code: "4404", metroArea: "Denver North", address: "4150 Ronald Reagan Boulevard", city: "Johnstown", state: "CO", zip: "80534", phone: "800-490-4901" },
  
  // ========== MOUNTAIN / PACIFIC NORTHWEST ==========
  { code: "4535", metroArea: "Boise", address: "2828 E Comstock Ave Bldg 2", city: "Nampa", state: "ID", zip: "83687", phone: "800-490-4901" },
  { code: "4530", metroArea: "Salt Lake City", address: "1545 S 4800 W", city: "Salt Lake City", state: "UT", zip: "84104", phone: "800-490-4901" },
  { code: "4412", metroArea: "Medford", address: "4787 Airway Drive", city: "Central Point", state: "OR", zip: "97502", phone: "800-490-4901" },
  { code: "4410", metroArea: "Portland", address: "2750 North Hayden Island Drive", city: "Portland", state: "OR", zip: "97217", phone: "800-490-4901" },
  { code: "4414", metroArea: "Seattle", address: "10002 Steele Street S.", city: "Tacoma", state: "WA", zip: "98444", phone: "800-490-4901" },
  { code: "4413", metroArea: "Spokane", address: "17710 E. Euclid Ave Ste 101", city: "Spokane Valley", state: "WA", zip: "99216", phone: "800-490-4901", notes: "NEW Address as of 2/6/2026" },
  
  // ========== CALIFORNIA / SOUTHWEST ==========
  { code: "4703", metroArea: "Fresno", address: "3220 S. Northpointe Drive", city: "Fresno", state: "CA", zip: "93725", phone: "800-490-4901" },
  { code: "4721", metroArea: "Las Vegas", address: "78 West Craig Road Building 3", city: "North Las Vegas", state: "NV", zip: "89032", phone: "800-490-4901" },
  { code: "4713", metroArea: "Oakland", address: "2000 Maritime Street, Ste 100", city: "Oakland", state: "CA", zip: "94607", phone: "800-490-4901" },
  { code: "4712", metroArea: "Phoenix", address: "2680 S 12th Place", city: "Phoenix", state: "AZ", zip: "85034", phone: "800-490-4901" },
  { code: "4705", metroArea: "Redlands", address: "1480 Mountain View", city: "Redlands", state: "CA", zip: "92374", phone: "800-490-4901" },
  { code: "4702", metroArea: "Sacramento", address: "1790 Bell Ave Suite 100", city: "Sacramento", state: "CA", zip: "95838", phone: "800-490-4901" },
  { code: "4711", metroArea: "San Diego", address: "4450 Ruffin Road", city: "San Diego", state: "CA", zip: "92123", phone: "800-490-4901" },
  { code: "4708", metroArea: "Santa Clarita", address: "21480 Needham Ranch Pkwy", city: "Santa Clarita", state: "CA", zip: "91321", phone: "800-490-4901" },
  { code: "4707", metroArea: "Santa Fe Springs", address: "13225 Alondra Boulevard", city: "Santa Fe Springs", state: "CA", zip: "90670", phone: "800-490-4901" },
  { code: "4704", metroArea: "Union City", address: "33375 Central Ave", city: "Union City", state: "CA", zip: "94587", phone: "800-490-4901" },
  
  // ========== NORTHEAST ==========
  { code: "4864", metroArea: "Baltimore", address: "1425 Magellan Road Suite C", city: "Hanover", state: "MD", zip: "21076", phone: "800-490-4901" },
  { code: "4862", metroArea: "Boston", address: "150 Hayes Memorial Drive", city: "Northborough", state: "MA", zip: "01532", phone: "800-490-4901" },
  { code: "4853", metroArea: "Croton-On-Hudson", address: "1 Half moon Bay Drive", city: "Croton-on-Hudson", state: "NY", zip: "10520", phone: "800-490-4901" },
  { code: "4854", metroArea: "Kirkwood", address: "1 Grossett Drive", city: "Kirkwood", state: "NY", zip: "13795", phone: "800-490-4901" },
  { code: "4857", metroArea: "Lewiston", address: "9 Gendron Drive", city: "Lewiston", state: "ME", zip: "04240", phone: "800-490-4901" },
  { code: "4852", metroArea: "Long Island", address: "45 Oser Ave", city: "Hauppauge", state: "NY", zip: "11788", phone: "800-490-4901" },
  { code: "4859", metroArea: "Myerstown - Mixing WHS", address: "100 Fort Motel Drive", city: "Meyerstown", state: "PA", zip: "17067", phone: "800-490-4901" },
  { code: "4860", metroArea: "Fairfield", address: "2 Hilton Ct", city: "Parsippany", state: "NJ", zip: "07054", phone: "800-490-4901", notes: "New Address as of 2/2/2026" },
  { code: "4863", metroArea: "Bordentown", address: "2471 Old York Road", city: "Bordentown", state: "NJ", zip: "08505", phone: "800-490-4901" },
  { code: "4867", metroArea: "Pittsburgh", address: "200 Solar Drive Suite 100", city: "Imperial", state: "PA", zip: "15126", phone: "800-490-4901" },
  { code: "4858", metroArea: "Randolph Center", address: "2281B Route 66", city: "Randolph Center", state: "VT", zip: "05061", phone: "800-490-4901" },
  { code: "4866", metroArea: "Richmond", address: "1962 Ruffin Mill Road", city: "Colonial Heights", state: "VA", zip: "23834", phone: "800-490-4901" },
  { code: "4861", metroArea: "Rochester", address: "401 Pixley Road Building C", city: "Rochester", state: "NY", zip: "14624", phone: "800-490-4901" },
  { code: "4855", metroArea: "South Windsor", address: "555 Nutmeg Road North", city: "South Windsor", state: "CT", zip: "06074", phone: "800-490-4901" },
  { code: "4865", metroArea: "Winchester", address: "40 Tyson Dr", city: "Winchester", state: "VA", zip: "22603", phone: "800-490-4901" },
];

/**
 * Get warehouse by code
 */
export function getWarehouse(code: string): USAutoForceWarehouse | undefined {
  return USAUTOFORCE_WAREHOUSES.find(w => w.code === code);
}

/**
 * Get warehouses by state
 */
export function getWarehousesByState(state: string): USAutoForceWarehouse[] {
  return USAUTOFORCE_WAREHOUSES.filter(w => w.state.toUpperCase() === state.toUpperCase());
}

/**
 * Get warehouses by metro area (fuzzy match)
 */
export function getWarehousesByMetro(metro: string): USAutoForceWarehouse[] {
  const search = metro.toLowerCase();
  return USAUTOFORCE_WAREHOUSES.filter(w => 
    w.metroArea.toLowerCase().includes(search) ||
    w.city.toLowerCase().includes(search)
  );
}

/**
 * Get all warehouse codes as array (for API calls)
 */
export function getAllWarehouseCodes(): string[] {
  return USAUTOFORCE_WAREHOUSES.map(w => w.code);
}
