
function cleanHistory(history) {
    if (history.length > 0 && history[0].role === 'model') {
        console.log('Cleaning: Removing initial "model" message.');
        history.shift();
    }
    return history;
}

// Test cases
const testCase1 = [
    { role: 'model', parts: [{ text: 'Hello' }] },
    { role: 'user', parts: [{ text: 'How are you?' }] }
];

const testCase2 = [
    { role: 'user', parts: [{ text: 'Hi' }] },
    { role: 'model', parts: [{ text: 'Hello' }] }
];

const testCase3 = [];

console.log('Test Case 1 (starts with model):');
const res1 = cleanHistory([...testCase1]);
console.log('Result length:', res1.length, 'First role:', res1[0]?.role);

console.log('\nTest Case 2 (starts with user):');
const res2 = cleanHistory([...testCase2]);
console.log('Result length:', res2.length, 'First role:', res2[0]?.role);

console.log('\nTest Case 3 (empty):');
const res3 = cleanHistory([...testCase3]);
console.log('Result length:', res3.length);
