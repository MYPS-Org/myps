import { generateInfraId, shouldAutoGenerateInfraId, getInfraTypePrefix, validateInfraIdFormat } from './infraIdGenerator';

// Test the infrastructure ID generation functionality
console.log('=== Infrastructure ID Generation Tests ===');

// Test infrastructure types
const testInfraTypes = [
  'Flood Control System',
  'Flood Control Structures', 
  'School Buildings',
  'Multi Purpose Buildings',
  'Water Supply Systems',
  'Hospitals',
  'Roads',
  'Bridges',
  'Airport Infrastructure',
  'Port Infrastructure',
  'Consultancy',
  'Non-Infra',
  'Custom Infrastructure Type'
];

testInfraTypes.forEach(infraType => {
  console.log(`\n--- ${infraType} ---`);
  console.log(`Should auto-generate: ${shouldAutoGenerateInfraId(infraType)}`);
  console.log(`Prefix: ${getInfraTypePrefix(infraType)}`);
  
  if (shouldAutoGenerateInfraId(infraType)) {
    const generatedId = generateInfraId(infraType);
    console.log(`Generated ID: ${generatedId}`);
    console.log(`Is valid format: ${validateInfraIdFormat(generatedId, infraType)}`);
  } else {
    console.log(`Uses selection dialog instead of auto-generation`);
  }
});

// Test multiple generations for same type
console.log('\n=== Multiple ID Generation Test ===');
console.log('Generating 5 IDs for "Flood Control System":');
for (let i = 0; i < 5; i++) {
  console.log(`ID ${i + 1}: ${generateInfraId('Flood Control System')}`);
}

// Test validation
console.log('\n=== Validation Tests ===');
const testValidations = [
  { id: 'FCS12345', type: 'Flood Control System', expected: true },
  { id: 'FCS1234', type: 'Flood Control System', expected: false }, // Wrong length
  { id: 'SCH54321', type: 'School Buildings', expected: true },
  { id: 'RD12345', type: 'Flood Control System', expected: false }, // Wrong prefix
];

testValidations.forEach(test => {
  const isValid = validateInfraIdFormat(test.id, test.type);
  const status = isValid === test.expected ? '✓ PASS' : '✗ FAIL';
  console.log(`${status} - ID: ${test.id}, Type: ${test.type}, Valid: ${isValid}`);
});

export {}; // Make this a module
