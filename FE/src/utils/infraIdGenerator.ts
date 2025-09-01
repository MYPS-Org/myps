/**
 * Utility functions for generating Infrastructure IDs based on Infrastructure Type
 */

/**
 * Generates a random infrastructure ID based on the infrastructure type
 * @param infraType - The infrastructure type (e.g., "Flood Control System", "Roads", "Bridges")
 * @returns A generated infrastructure ID with format: [PREFIX]+[5 random numbers]
 */
export const generateInfraId = (infraType: string): string => {
  if (!infraType) {
    return generateRandomId('OTH'); // Default for unknown types
  }

  const prefix = getInfraTypePrefix(infraType);
  const randomNumbers = generateRandomNumbers(5);
  return `${prefix}${randomNumbers}`;
};

/**
 * Gets the abbreviation prefix for a given infrastructure type
 * @param infraType - The infrastructure type
 * @returns The abbreviated prefix
 */
export const getInfraTypePrefix = (infraType: string): string => {
  const type = infraType.toLowerCase().trim();
  
  // Define mappings for infrastructure type to prefix
  const prefixMappings: { [key: string]: string } = {
    // Flood Control related
    'flood control system': 'FCS',
    'flood control systems': 'FCS',
    'flood control structures': 'FCS',
    'flood control structure': 'FCS',
    'flood mitigation structure': 'FMS',
    'flood mitigation structures': 'FMS',
    
    // Roads
    'road': 'RD',
    'roads': 'RD',
    
    // Bridges
    'bridge': 'BR',
    'bridges': 'BR',
    
    // Buildings
    'school building': 'SCH',
    'school buildings': 'SCH',
    'multi purpose building': 'MPB',
    'multi purpose buildings': 'MPB',
    'other building': 'OTB',
    'other buildings': 'OTB',
    'hospital': 'HSP',
    'hospitals': 'HSP',
    
    // Water Systems
    'water supply system': 'WSS',
    'water supply systems': 'WSS',
    'waterway': 'WW',
    'waterways': 'WW',
    
    // Other Infrastructure
    'airport infrastructure': 'AI',
    'port infrastructure': 'PI',
    'accessibility facility': 'AF',
    'consultancy': 'CON',
    'non-infra': 'NI',
  };
  
  // Check for exact matches first
  if (prefixMappings[type]) {
    return prefixMappings[type];
  }
  
  // Check for partial matches (contains keywords)
  for (const [key, prefix] of Object.entries(prefixMappings)) {
    if (type.includes(key) || key.includes(type)) {
      return prefix;
    }
  }
  
  // Fallback: generate prefix from first letters of words
  const words = type.split(/\s+/);
  if (words.length >= 2) {
    // Take first 2-3 letters from first words
    return words.slice(0, 3)
      .map(word => word.charAt(0).toUpperCase())
      .join('')
      .substring(0, 3);
  } else if (words.length === 1) {
    // Single word: take first 3 characters
    return words[0].substring(0, 3).toUpperCase();
  }
  
  return 'OTH'; // Default fallback
};

/**
 * Generates a string of random numbers
 * @param length - The number of digits to generate
 * @returns A string of random digits
 */
const generateRandomNumbers = (length: number): string => {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += Math.floor(Math.random() * 10).toString();
  }
  return result;
};

/**
 * Generates a random ID with a given prefix
 * @param prefix - The prefix to use
 * @returns A generated ID with format: [PREFIX]+[5 random numbers]
 */
const generateRandomId = (prefix: string): string => {
  const randomNumbers = generateRandomNumbers(5);
  return `${prefix}${randomNumbers}`;
};

/**
 * Checks if an infrastructure type should use automatic ID generation
 * (i.e., not use the infrastructure selection dialog)
 * @param infraType - The infrastructure type
 * @returns True if should auto-generate, false if should use selection dialog
 */
export const shouldAutoGenerateInfraId = (infraType: string): boolean => {
  if (!infraType) return true;
  
  const type = infraType.toLowerCase().trim();
  
  // These types have predefined infrastructure that can be selected
  const selectableTypes = ['road', 'roads', 'bridge', 'bridges'];
  
  return !selectableTypes.includes(type);
};

/**
 * Validates if an infrastructure ID follows the expected format
 * @param infraId - The infrastructure ID to validate
 * @param infraType - The infrastructure type
 * @returns True if valid format, false otherwise
 */
export const validateInfraIdFormat = (infraId: string, infraType: string): boolean => {
  if (!infraId || !infraType) return false;
  
  const expectedPrefix = getInfraTypePrefix(infraType);
  const pattern = new RegExp(`^${expectedPrefix}\\d{5}$`);
  
  return pattern.test(infraId);
};
