const text = "test@example.com, another@test.co.uk\nInvalid string\nthird@email.com";
const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const matches = text.match(emailRegex) || [];
console.log("Matches found:", matches);

if (matches.length === 3) {
    console.log("Regex Validation: PASSED");
} else {
    console.log("Regex Validation: FAILED");
}
