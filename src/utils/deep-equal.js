// Method 3: Custom recursive comparison
function deepEqual(obj1, obj2) {
  // Check if both are primitive values
  if (obj1 === obj2) return true;
  
  // Check if either is null or not an object
  if (typeof obj1 !== 'object' || obj1 === null ||
      typeof obj2 !== 'object' || obj2 === null) {debugger; return false;}
  
  // Get keys of both objects
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  
  // Check if number of keys is different
  if (keys1.length !== keys2.length) {debugger; return false;}
  
  // Recursively compare all properties
  for (const key of keys1) {
      if (!keys2.includes(key)) {debugger; return false;}
      if (!deepEqual(obj1[key], obj2[key])) {debugger; return false;}
  }
  
  return true;
}