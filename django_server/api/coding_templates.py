import re


DEFAULT_MULTI_LANGUAGES = ["python", "javascript", "typescript", "java", "c", "cpp", "go", "rust", "c#", "kotlin", "php", "ruby", "swift"]
TEMPLATE_DEFERRED_LANGUAGES = {"c#", "kotlin", "php", "ruby", "swift"}

LANGUAGE_ONLY_PATTERN = re.compile(
    r"^(?:(?:give|show|write|send)(?:\s+it)?\s+)?(?:in\s+)?(python|javascript|js|typescript|ts|java|c\+\+|cpp|c#|csharp|c|go|golang|rust|kotlin|php|ruby|swift)\b$",
    re.I,
)
CODE_ONLY_PATTERN = re.compile(
    r"^(code|show code|give code|send code|full code|complete code|whole code|python code|java code|javascript code|typescript code|c code|c\+\+ code)$",
    re.I,
)
SHORT_CODE_FOLLOWUP_PATTERN = re.compile(
    r"^(code|show code|give code|send code|full code|complete code|whole code)\b",
    re.I,
)
FULL_CODE_PATTERN = re.compile(
    r"\b(full code|complete code|whole code|full program|complete program|with main|main function|int main|where is int main|whwere is int main)\b",
    re.I,
)
CONTEST_PROMPT_PATTERN = re.compile(
    r"\b(leetcode|codeforces|codechef|hackerrank|contest|competitive programming|input format|output format|constraints?|given an array|given a string|given a graph|given a tree|given a grid|subarray|substring|mod(?:ulo)?\s+1e9\+7|return the|find the|minimize|maximize|at most|at least)\b|(?:n|m|k)\s*(?:<=|<)\s*\d+",
    re.I,
)
CODE_REQUEST_PATTERN = re.compile(
    r"\b(write|give|show|create|implement|build|generate)\b.*\b(code|function|program|script|api)\b|\b(code for|function for)\b|\b(add(?:ing|ng)?|sum)\b.*\b(two|2|number|numbers|bumber|bumbers)\b.*\b(code|function|program)\b",
    re.I,
)
KNOWN_CODE_TASK_PATTERN = re.compile(
    r"\b(add(?:ing|ng)?|factorial|fibonacci|gcd|greatest common divisor|lcm|least common multiple|trie|prefix tree|prime|palindrome|reverse|string|binary\s+search|two\s*sum|sort|sorting|merge intervals|subarray sum|substring|binary tree|django|api|login)\b",
    re.I,
)
CODING_CAPABILITY_PATTERN = re.compile(r"\b(all coding|know .*coding|coding knowledge|help .*coding|good .*coding)\b", re.I)
GENERIC_DEBUG_PATTERN = re.compile(r"\b(fix|debug|bug|issue|error|crash)\b", re.I)


def normalize_space(text):
    return re.sub(r"\s+", " ", str(text or "").strip()).strip()


def count_words(text):
    return len([token for token in normalize_space(text).split(" ") if token])


def is_shallow_code_followup(text):
    trimmed = normalize_space(text)
    if not trimmed:
        return False
    return bool(SHORT_CODE_FOLLOWUP_PATTERN.match(trimmed) or LANGUAGE_ONLY_PATTERN.match(trimmed) or CODE_ONLY_PATTERN.match(trimmed))


def detect_requested_languages(text):
    lowered = normalize_space(text).lower()
    if re.search(r"\ball\s+languages?\b|\bevery\s+language\b", lowered):
        return list(DEFAULT_MULTI_LANGUAGES)

    picked = []
    if re.search(r"\bc\+\+|\bcpp\b", lowered):
        picked.append("cpp")
    if re.search(r"\bc#|\bcsharp\b", lowered):
        picked.append("c#")
    if re.search(r"(^|\s)c(\s|$)|\bc code\b", lowered):
        picked.append("c")
    if re.search(r"\bpython\b", lowered):
        picked.append("python")
    if re.search(r"\bjavascript\b|\bjs\b", lowered):
        picked.append("javascript")
    if re.search(r"\btypescript\b|\bts\b", lowered):
        picked.append("typescript")
    if re.search(r"\bjava\b", lowered):
        picked.append("java")
    if re.search(r"\bgo(lang)?\b", lowered):
        picked.append("go")
    if re.search(r"\brust\b", lowered):
        picked.append("rust")
    if re.search(r"\bkotlin\b", lowered):
        picked.append("kotlin")
    if re.search(r"\bphp\b", lowered):
        picked.append("php")
    if re.search(r"\bruby\b", lowered):
        picked.append("ruby")
    if re.search(r"\bswift\b", lowered):
        picked.append("swift")

    if not picked:
        return ["python"]
    return list(dict.fromkeys(picked))


def strip_language_mentions(text):
    return normalize_space(
        re.sub(
            r"\b(?:(?:give|show|write|send)(?:\s+it)?\s+)?(?:in\s+)?(python|javascript|js|typescript|ts|java|c\+\+|cpp|c#|csharp|c|go|golang|rust|kotlin|php|ruby|swift)\b",
            " ",
            str(text or ""),
            flags=re.I,
        )
    )


def looks_like_contest_problem(text):
    normalized = normalize_space(text).lower()
    if not normalized:
        return False
    if CONTEST_PROMPT_PATTERN.search(normalized):
        return True
    return (
        re.search(r"\b(array|string|graph|tree|grid|matrix)\b", normalized)
        and re.search(r"\b(find|return|count|min|max|shortest|longest)\b", normalized)
        and count_words(normalized) >= 10
    )


def detect_coding_task(user_text):
    lowered = normalize_space(user_text).lower()

    if all(token in lowered for token in ("django", "login", "api")) or all(token in lowered for token in ("django", "auth")):
        return {
            "id": "django_login_api",
            "label": "Django Login API",
            "complexity": "O(1) application work plus database/auth lookup",
            "logic": [
                "Read credentials from the request body and authenticate with Django auth.",
                "Return a token or session payload on success and a clear 401 response on failure.",
            ],
        }

    if all(token in lowered for token in ("django", "rest", "api")) or ("django" in lowered and "api" in lowered and "crud" in lowered):
        return {
            "id": "django_rest_api",
            "label": "Django REST API Scaffold",
            "complexity": "Standard CRUD endpoint cost per request",
            "logic": [
                "Define a model, serializer, and viewset in Django REST Framework.",
                "Register the viewset in a router so list/create/retrieve/update/delete routes are created.",
            ],
        }

    if re.search(r"\b(two\s*sum|pair\s+sum|target\s+sum)\b", lowered):
        return {
            "id": "two_sum",
            "label": "Two Sum",
            "complexity": "O(n) time, O(n) space",
            "logic": [
                "Traverse the array once and store visited values in a hash map.",
                "For each value x, check whether target - x already exists in the map.",
            ],
        }

    if re.search(r"\bbinary\s+search\b", lowered):
        return {
            "id": "binary_search",
            "label": "Binary Search",
            "complexity": "O(log n) time, O(1) space",
            "logic": [
                "Maintain low/high pointers on a sorted array.",
                "Compare the mid element with the target and shrink the search half each step.",
            ],
        }

    if re.search(r"\b(gcd|greatest\s+common\s+divisor|euclid(?:ean)?\s+algorithm)\b", lowered):
        return {
            "id": "gcd",
            "label": "Greatest Common Divisor",
            "complexity": "O(log(min(a, b))) time, O(1) space",
            "logic": [
                "Use the Euclidean algorithm: repeatedly replace (a, b) with (b, a mod b).",
                "Stop when the second value becomes 0; the first value is the gcd.",
            ],
        }

    if re.search(r"\b(lcm|least\s+common\s+multiple)\b", lowered):
        return {
            "id": "lcm",
            "label": "Least Common Multiple",
            "complexity": "O(log(min(a, b))) time, O(1) space",
            "logic": [
                "Compute gcd first with the Euclidean algorithm.",
                "Use lcm(a, b) = abs(a * b) / gcd(a, b), while handling zero safely.",
            ],
        }

    if re.search(r"\bfactorial\b", lowered):
        return {
            "id": "factorial",
            "label": "Factorial",
            "complexity": "O(n) time, O(1) space (iterative)",
            "logic": [
                "Multiply values from 2 to n.",
                "Return 1 for n = 0 or n = 1.",
            ],
        }

    if re.search(r"\bfibonacci|fibo\b", lowered):
        return {
            "id": "fibonacci",
            "label": "Fibonacci",
            "complexity": "O(n) time, O(1) space (iterative)",
            "logic": [
                "Track the previous two values and iterate to n.",
                "Avoid naive recursion for large n because it is exponential.",
            ],
        }

    if re.search(r"\bprime\b", lowered):
        return {
            "id": "prime_check",
            "label": "Prime Check",
            "complexity": "O(sqrt(n)) time, O(1) space",
            "logic": [
                "Handle n <= 1 as not prime.",
                "Try dividing from 2 up to sqrt(n).",
            ],
        }

    if re.search(r"\bpalindrome\b", lowered):
        return {
            "id": "palindrome",
            "label": "Palindrome String Check",
            "complexity": "O(n) time, O(1) extra space",
            "logic": [
                "Use two pointers from both ends of the string.",
                "If any mismatch appears, it is not a palindrome.",
            ],
        }

    if (re.search(r"\breverse\b", lowered) and re.search(r"\bstring\b", lowered)) or re.search(r"\bstring\b.*\breverse\b", lowered):
        return {
            "id": "reverse_string",
            "label": "Reverse String",
            "complexity": "O(n) time, O(n) space for immutable strings",
            "logic": [
                "Traverse characters in reverse order.",
                "Build the reversed output string.",
            ],
        }

    if re.search(r"\bsort|sorting|bubble sort|quick sort|merge sort\b", lowered):
        return {
            "id": "sort_array",
            "label": "Sort Array",
            "complexity": "O(n log n) average time with built-in sort",
            "logic": [
                "Use comparator-based sort.",
                "For interview constraints, replace it with explicit merge sort or quick sort if needed.",
            ],
        }

    if re.search(r"\badd(?:ing|ng)?\b.*\b(two|2|number|numbers|bumber|bumbers)\b|\bsum\b.*\b(two|2)\b.*\b(number|numbers)\b", lowered):
        return {
            "id": "add_two_numbers",
            "label": "Add Two Numbers",
            "complexity": "O(1) time, O(1) space",
            "logic": [
                "Return the sum of two input values.",
                "Use numeric types that fit the expected range.",
            ],
        }

    if re.search(r"\blongest\s+substring\b.*\bwithout\s+repeating\b|\bwithout\s+repeating\s+characters?\b", lowered):
        return {
            "id": "longest_substring_no_repeat",
            "label": "Longest Substring Without Repeating Characters",
            "complexity": "O(n) time, O(min(n, alphabet)) space",
            "logic": [
                "Use a sliding window and remember the last seen index of each character.",
                "Move the left pointer only forward when a duplicate enters the window.",
            ],
        }

    if re.search(r"\b(maximum|max)\s+subarray\b|\bkadane\b", lowered):
        return {
            "id": "maximum_subarray",
            "label": "Maximum Subarray",
            "complexity": "O(n) time, O(1) space",
            "logic": [
                "Use Kadane's algorithm to keep the best subarray ending at the current index.",
                "Track the global maximum while scanning once from left to right.",
            ],
        }

    if re.search(r"\bmerge\s+intervals?\b", lowered):
        return {
            "id": "merge_intervals",
            "label": "Merge Intervals",
            "complexity": "O(n log n) time, O(n) space",
            "logic": [
                "Sort intervals by start time first.",
                "Merge with the last output interval while ranges overlap.",
            ],
        }

    if re.search(r"\bsubarray\s+sum\b.*\bk\b|\bsum\s+equals\s+k\b", lowered):
        return {
            "id": "subarray_sum_k",
            "label": "Subarray Sum Equals K",
            "complexity": "O(n) time, O(n) space",
            "logic": [
                "Maintain prefix sums and count how many times each prefix has appeared.",
                "For each prefix sum s, add the count of prefix sum s - k.",
            ],
        }

    if re.search(r"\b(trie|prefix\s+tree)\b", lowered):
        return {
            "id": "trie",
            "label": "Trie / Prefix Tree",
            "complexity": "O(L) per insert/search/prefix query, where L is word length",
            "logic": [
                "Store child nodes per character while walking from the root.",
                "Track full-word endings separately so exact-word search and prefix search both work.",
            ],
        }

    if re.search(r"\b(binary|binaray)\s+tree\b|\bbinary\s+search\s+tree\b|\bbst\b", lowered):
        return {
            "id": "binary_tree",
            "label": "Binary Tree / BST Basics",
            "complexity": "O(h) average insert/search for BST, where h is tree height",
            "logic": [
                "Define a node structure with value, left, and right child references.",
                "Insert values recursively based on BST ordering and use inorder traversal to print the sorted sequence.",
            ],
        }

    if re.search(r"\b(pos tagging|pos tag|part of speech|part-of-speech|tag parts of speech)\b", lowered):
        return {
            "id": "pos_tagging",
            "label": "Part-of-Speech Tagging",
            "complexity": "O(n) time for the token stream (model-dependent constants)",
            "logic": [
                "Tokenize the sentence into words.",
                "Apply a POS tagger model to assign grammatical tags.",
            ],
        }

    return {
        "id": "generic",
        "label": "Custom Coding Task",
        "complexity": "Depends on problem constraints",
        "logic": [
            "Define the input/output contract clearly.",
            "Implement the core logic, then validate edge cases.",
        ],
    }


def detect_coding_style(text, prefer_full_code=False):
    lowered = normalize_space(text).lower()
    return {
        "wants_recursive": bool(re.search(r"\b(recursive|recursion)\b", lowered)),
        "wants_iterative": bool(re.search(r"\b(iterative|loop based|without recursion)\b", lowered)),
        "wants_different": bool(re.search(r"\b(different logic|alternative|another way|optimized|other approach)\b", lowered)),
        "wants_full_code": bool(prefer_full_code or FULL_CODE_PATTERN.search(lowered)),
    }


def supported_languages_for_task(task_id):
    if task_id in {"django_login_api", "django_rest_api"}:
        return ["python"]
    if task_id in {"longest_substring_no_repeat", "maximum_subarray", "merge_intervals", "subarray_sum_k"}:
        return ["python", "javascript", "typescript", "java", "cpp"]
    return None


def edge_cases_for_task(task_id):
    if task_id == "two_sum":
        return ["Duplicate numbers.", "Negative values.", "No valid pair if the platform allows it."]
    if task_id == "binary_search":
        return ["Target missing from the array.", "Array of length 1.", "Repeated values if first/last occurrence matters."]
    if task_id == "gcd":
        return ["One number is 0.", "Both numbers are 0 if your platform defines it specially.", "Negative inputs should usually return a non-negative gcd."]
    if task_id == "lcm":
        return ["Either number is 0.", "Negative inputs should usually return a non-negative lcm.", "Watch overflow when multiplying before division."]
    if task_id == "longest_substring_no_repeat":
        return ["Empty string.", "All characters identical.", "Window reset when the repeated character is inside the current window."]
    if task_id == "maximum_subarray":
        return ["All numbers negative.", "Single-element array.", "Large positive/negative swings."]
    if task_id == "merge_intervals":
        return ["Already sorted intervals.", "Fully nested intervals.", "Touching intervals if the platform treats them as overlapping."]
    if task_id == "subarray_sum_k":
        return ["Negative numbers present, so sliding window is not safe.", "k = 0.", "Multiple equal prefix sums."]
    if task_id == "trie":
        return ["Searching for a full word versus only checking a prefix.", "Inserting the same word more than once.", "Empty strings if your API allows them."]
    if task_id == "django_login_api":
        return ["Missing credentials.", "Inactive/unverified users if your app requires verification.", "Token/session issuance strategy must match your auth stack."]
    if task_id == "django_rest_api":
        return ["Validation errors on create/update.", "Authentication/permission checks.", "Pagination and filtering if the dataset grows."]
    if task_id == "generic":
        return ["Minimum-size input.", "Maximum-size input.", "Repeated values, boundary indices, and overflow risk."]
    return ["Empty input.", "Single-element input.", "Very large input near constraint limits."]


def snippet_by_language(language, snippets):
    return snippets.get(language) or ""


def has_entry_point(language, snippet):
    source = str(snippet or "")
    if language == "python":
        return 'if __name__ == "__main__":' in source
    if language == "java":
        return bool(re.search(r"\bpublic\s+class\s+Main\b|\bstatic\s+void\s+main\s*\(", source))
    if language in {"c", "cpp"}:
        return bool(re.search(r"\bmain\s*\(", source))
    if language in {"javascript", "typescript"}:
        return bool(re.search(r"\bfunction\s+main\s*\(|\bconst\s+main\s*=\s*\(|console\.log\s*\(", source))
    if language == "go":
        return bool(re.search(r"\bfunc\s+main\s*\(", source))
    if language == "rust":
        return bool(re.search(r"\bfn\s+main\s*\(", source))
    if language == "c#":
        return bool(re.search(r"\bstatic\s+void\s+Main\s*\(", source))
    if language == "kotlin":
        return bool(re.search(r"\bfun\s+main\s*\(", source))
    if language == "php":
        return source.lstrip().startswith("<?php")
    if language == "ruby":
        return bool(re.search(r"\bdef\s+main\b|\bputs\b", source))
    if language == "swift":
        return bool(re.search(r"\bfunc\s+main\s*\(|\bprint\s*\(", source))
    return False


def indent_code(text, spaces=2):
    pad = " " * spaces
    return "\n".join(f"{pad}{line}" if line else line for line in str(text or "").splitlines())


def sample_usage_block(task_id, language):
    samples = {
        "add_two_numbers": {
            "python": 'print(add(10, 20))',
            "javascript": "console.log(add(10, 20));",
            "typescript": "console.log(add(10, 20));",
            "java": "System.out.println(add(10, 20));",
            "c": 'printf("%d\\n", add(10, 20));',
            "cpp": "cout << add(10, 20) << '\\n';",
            "go": "fmt.Println(Add(10, 20))",
            "rust": 'println!("{}", add(10, 20));',
            "c#": "Console.WriteLine(Add(10, 20));",
        },
        "factorial": {
            "python": 'print(factorial(5))',
            "javascript": "console.log(factorial(5));",
            "typescript": "console.log(factorial(5));",
            "java": "System.out.println(factorial(5));",
            "c": 'printf("%lld\\n", factorial(5));',
            "cpp": "cout << factorial(5) << '\\n';",
            "go": "fmt.Println(Factorial(5))",
            "rust": 'println!("{}", factorial(5));',
            "c#": "Console.WriteLine(Factorial(5));",
        },
        "fibonacci": {
            "python": 'print(fibonacci(10))',
            "javascript": "console.log(fibonacci(10));",
            "typescript": "console.log(fibonacci(10));",
            "java": "System.out.println(fibonacci(10));",
            "c": 'printf("%lld\\n", fibonacci(10));',
            "cpp": "cout << fibonacci(10) << '\\n';",
            "go": "fmt.Println(Fibonacci(10))",
            "rust": 'println!("{}", fibonacci(10));',
            "c#": "Console.WriteLine(Fibonacci(10));",
        },
        "prime_check": {
            "python": 'print(is_prime(29))',
            "javascript": "console.log(isPrime(29));",
            "typescript": "console.log(isPrime(29));",
            "java": "System.out.println(isPrime(29));",
            "c": 'printf("%d\\n", is_prime(29));',
            "cpp": "cout << boolalpha << isPrime(29) << '\\n';",
            "go": "fmt.Println(IsPrime(29))",
            "rust": 'println!("{}", is_prime(29));',
            "c#": "Console.WriteLine(IsPrime(29));",
        },
        "palindrome": {
            "python": 'print(is_palindrome("madam"))',
            "javascript": 'console.log(isPalindrome("madam"));',
            "typescript": 'console.log(isPalindrome("madam"));',
            "java": 'System.out.println(isPalindrome("madam"));',
            "c": 'printf("%d\\n", is_palindrome("madam"));',
            "cpp": 'cout << boolalpha << isPalindrome("madam") << \'\\n\';',
            "go": 'fmt.Println(IsPalindrome("madam"))',
            "rust": 'println!("{}", is_palindrome("madam"));',
            "c#": 'Console.WriteLine(IsPalindrome("madam"));',
        },
        "reverse_string": {
            "python": 'print(reverse_string("energy"))',
            "javascript": 'console.log(reverseString("energy"));',
            "typescript": 'console.log(reverseString("energy"));',
            "java": 'System.out.println(reverseString("energy"));',
            "cpp": 'cout << reverseString("energy") << \'\\n\';',
            "go": 'fmt.Println(ReverseString("energy"))',
            "rust": 'println!("{}", reverse_string("energy"));',
            "c#": 'Console.WriteLine(ReverseString("energy"));',
        },
        "binary_search": {
            "python": 'print(binary_search([1, 3, 5, 7, 9], 7))',
            "javascript": "console.log(binarySearch([1, 3, 5, 7, 9], 7));",
            "typescript": "console.log(binarySearch([1, 3, 5, 7, 9], 7));",
            "java": "System.out.println(binarySearch(new int[]{1, 3, 5, 7, 9}, 7));",
            "c": 'int arr[] = {1, 3, 5, 7, 9};\nprintf("%d\\n", binary_search(arr, 5, 7));',
            "cpp": "cout << binarySearch(vector<int>{1, 3, 5, 7, 9}, 7) << '\\n';",
            "go": "fmt.Println(BinarySearch([]int{1, 3, 5, 7, 9}, 7))",
            "rust": 'println!("{}", binary_search(&[1, 3, 5, 7, 9], 7));',
            "c#": "Console.WriteLine(BinarySearch(new[] { 1, 3, 5, 7, 9 }, 7));",
        },
        "gcd": {
            "python": "print(gcd(48, 18))",
            "javascript": "console.log(gcd(48, 18));",
            "typescript": "console.log(gcd(48, 18));",
            "java": "System.out.println(gcd(48, 18));",
            "c": 'printf("%d\\n", gcd(48, 18));',
            "cpp": "cout << gcd(48, 18) << '\\n';",
            "go": "fmt.Println(GCD(48, 18))",
            "rust": 'println!("{}", gcd(48, 18));',
            "c#": "Console.WriteLine(Gcd(48, 18));",
            "kotlin": "println(gcd(48, 18))",
            "php": "echo gcd(48, 18) . PHP_EOL;",
            "ruby": "puts gcd(48, 18)",
            "swift": "print(gcd(48, 18))",
        },
        "lcm": {
            "python": "print(lcm(12, 18))",
            "javascript": "console.log(lcm(12, 18));",
            "typescript": "console.log(lcm(12, 18));",
            "java": "System.out.println(lcm(12, 18));",
            "c": 'printf("%d\\n", lcm(12, 18));',
            "cpp": "cout << lcm(12, 18) << '\\n';",
            "go": "fmt.Println(LCM(12, 18))",
            "rust": 'println!("{}", lcm(12, 18));',
            "c#": "Console.WriteLine(Lcm(12, 18));",
            "kotlin": "println(lcm(12, 18))",
            "php": "echo lcm(12, 18) . PHP_EOL;",
            "ruby": "puts lcm(12, 18)",
            "swift": "print(lcm(12, 18))",
        },
        "sort_array": {
            "python": 'print(sort_array([5, 2, 9, 1, 3]))',
            "javascript": "console.log(sortArray([5, 2, 9, 1, 3]));",
            "typescript": "console.log(sortArray([5, 2, 9, 1, 3]));",
            "java": "System.out.println(Arrays.toString(sortArray(new int[]{5, 2, 9, 1, 3})));",
            "c": "int arr[] = {5, 2, 9, 1, 3};\nsort_array(arr, 5);\nfor (int i = 0; i < 5; i++) printf(\"%d \", arr[i]);\nprintf(\"\\n\");",
            "cpp": "auto sorted = sortArray(vector<int>{5, 2, 9, 1, 3});\nfor (int x : sorted) cout << x << ' ';\ncout << '\\n';",
            "go": "fmt.Println(SortArray([]int{5, 2, 9, 1, 3}))",
            "rust": 'println!("{:?}", sort_array(vec![5, 2, 9, 1, 3]));',
        },
        "two_sum": {
            "python": 'print(two_sum([2, 7, 11, 15], 9))',
            "javascript": "console.log(twoSum([2, 7, 11, 15], 9));",
            "typescript": "console.log(twoSum([2, 7, 11, 15], 9));",
            "java": "System.out.println(Arrays.toString(twoSum(new int[]{2, 7, 11, 15}, 9)));",
            "c": 'int nums[] = {2, 7, 11, 15};\nint i1 = -1, i2 = -1;\nif (two_sum(nums, 4, 9, &i1, &i2)) printf("%d %d\\n", i1, i2);',
            "cpp": "auto answer = twoSum(*(new vector<int>{2, 7, 11, 15}), 9);\ncout << answer[0] << ' ' << answer[1] << '\\n';",
            "go": "fmt.Println(TwoSum([]int{2, 7, 11, 15}, 9))",
            "rust": 'println!("{:?}", two_sum(&[2, 7, 11, 15], 9));',
            "c#": "Console.WriteLine(string.Join(\", \", TwoSum(new[] { 2, 7, 11, 15 }, 9)));",
        },
        "longest_substring_no_repeat": {
            "python": 'print(length_of_longest_substring("abcabcbb"))',
            "javascript": 'console.log(lengthOfLongestSubstring("abcabcbb"));',
            "typescript": 'console.log(lengthOfLongestSubstring("abcabcbb"));',
            "java": 'System.out.println(lengthOfLongestSubstring("abcabcbb"));',
            "cpp": 'cout << lengthOfLongestSubstring("abcabcbb") << \'\\n\';',
        },
        "maximum_subarray": {
            "python": 'print(max_subarray([-2, 1, -3, 4, -1, 2, 1, -5, 4]))',
            "javascript": "console.log(maxSubArray([-2, 1, -3, 4, -1, 2, 1, -5, 4]));",
            "typescript": "console.log(maxSubArray([-2, 1, -3, 4, -1, 2, 1, -5, 4]));",
            "java": "System.out.println(maxSubArray(new int[]{-2, 1, -3, 4, -1, 2, 1, -5, 4}));",
            "cpp": "vector<int> nums{-2, 1, -3, 4, -1, 2, 1, -5, 4};\ncout << maxSubArray(nums) << '\\n';",
        },
        "merge_intervals": {
            "python": 'print(merge([[1, 3], [2, 6], [8, 10], [15, 18]]))',
            "javascript": "console.log(merge([[1, 3], [2, 6], [8, 10], [15, 18]]));",
            "typescript": "console.log(merge([[1, 3], [2, 6], [8, 10], [15, 18]]));",
            "java": "int[][] merged = merge(new int[][]{{1, 3}, {2, 6}, {8, 10}, {15, 18}});\nfor (int[] interval : merged) System.out.println(Arrays.toString(interval));",
            "cpp": "vector<vector<int>> intervals{{1, 3}, {2, 6}, {8, 10}, {15, 18}};\nauto merged = merge(intervals);\nfor (const auto& interval : merged) cout << '[' << interval[0] << ',' << interval[1] << \"] \";\ncout << '\\n';",
            "c#": "int[][] merged = Merge(new[]\n{\n    new[] { 1, 3 },\n    new[] { 2, 6 },\n    new[] { 8, 10 },\n    new[] { 15, 18 },\n});\nforeach (int[] interval in merged) Console.WriteLine($\"[{interval[0]}, {interval[1]}]\");",
        },
        "subarray_sum_k": {
            "python": 'print(subarray_sum([1, 1, 1], 2))',
            "javascript": "console.log(subarraySum([1, 1, 1], 2));",
            "typescript": "console.log(subarraySum([1, 1, 1], 2));",
            "java": "System.out.println(subarraySum(new int[]{1, 1, 1}, 2));",
            "cpp": "vector<int> nums{1, 1, 1};\ncout << subarraySum(nums, 2) << '\\n';",
        },
        "trie": {
            "python": 'trie = Trie()\ntrie.insert("cat")\ntrie.insert("car")\nprint(trie.search("cat"))\nprint(trie.starts_with("ca"))',
            "javascript": 'const trie = new Trie();\ntrie.insert("cat");\ntrie.insert("car");\nconsole.log(trie.search("cat"));\nconsole.log(trie.startsWith("ca"));',
            "typescript": 'const trie = new Trie();\ntrie.insert("cat");\ntrie.insert("car");\nconsole.log(trie.search("cat"));\nconsole.log(trie.startsWith("ca"));',
            "java": 'Trie trie = new Trie();\ntrie.insert("cat");\ntrie.insert("car");\nSystem.out.println(trie.search("cat"));\nSystem.out.println(trie.startsWith("ca"));',
            "cpp": 'Trie trie;\ntrie.insert("cat");\ntrie.insert("car");\ncout << boolalpha << trie.search("cat") << \'\\n\';\ncout << boolalpha << trie.startsWith("ca") << \'\\n\';',
            "go": 'trie := NewTrie()\ntrie.Insert("cat")\ntrie.Insert("car")\nfmt.Println(trie.Search("cat"))\nfmt.Println(trie.StartsWith("ca"))',
            "rust": 'let mut trie = Trie::new();\ntrie.insert("cat");\ntrie.insert("car");\nprintln!("{}", trie.search("cat"));\nprintln!("{}", trie.starts_with("ca"));',
            "c#": 'var trie = new Trie();\ntrie.Insert("cat");\ntrie.Insert("car");\nConsole.WriteLine(trie.Search("cat"));\nConsole.WriteLine(trie.StartsWith("ca"));',
        },
        "binary_tree": {
            "python": "root = None\nfor value in [5, 3, 7, 1, 4]:\n    root = insert(root, value)\ninorder(root)\nprint()",
            "javascript": "let root = null;\nfor (const value of [5, 3, 7, 1, 4]) root = insert(root, value);\nconsole.log(inorder(root));",
            "java": "Node root = null;\nfor (int value : new int[]{5, 3, 7, 1, 4}) root = insert(root, value);",
            "cpp": "Node* root = nullptr;\nfor (int value : vector<int>{5, 3, 7, 1, 4}) root = insert(root, value);",
            "go": "fmt.Println(\"Insert sample values like 5, 3, 7, 1, 4 and print inorder traversal.\")",
            "rust": 'println!("Build the tree with sample values and print inorder traversal.");',
        },
        "pos_tagging": {
            "python": 'print(pos_tag_sentence("Energy AI writes code."))',
            "javascript": 'console.log(posTagSentence("Energy AI writes code."));',
        },
        "generic": {
            "python": "print(solve())",
            "javascript": "console.log(solve());",
            "typescript": "console.log(solve());",
            "java": "System.out.println(solve());",
            "c": 'printf("%d\\n", solve());',
            "cpp": "cout << solve() << '\\n';",
            "go": "fmt.Println(Solve())",
            "rust": 'println!("{:?}", solve());',
            "c#": "Console.WriteLine(Solve());",
            "kotlin": "println(solve())",
            "php": "echo solve() . PHP_EOL;",
            "ruby": "puts solve",
            "swift": "print(solve())",
        },
    }
    return samples.get(task_id, {}).get(language, "")


def apply_full_program_wrapper(task_id, language, snippet, wants_full_code):
    if not wants_full_code:
        return snippet

    if task_id in {"django_login_api", "django_rest_api"}:
        return snippet

    if not str(snippet or "").strip():
        return ""

    if has_entry_point(language, snippet):
        return snippet

    usage = sample_usage_block(task_id, language)

    if language == "python":
        body = usage or 'print("Ready to run.")'
        return f'{snippet}\n\nif __name__ == "__main__":\n{indent_code(body, 4)}'
    if language == "javascript":
        body = usage or 'console.log("Ready to run.");'
        return f'{snippet}\n\nfunction main() {{\n{indent_code(body, 2)}\n}}\n\nmain();'
    if language == "typescript":
        body = usage or 'console.log("Ready to run.");'
        return f'{snippet}\n\nfunction main(): void {{\n{indent_code(body, 2)}\n}}\n\nmain();'
    if language == "java":
        body = usage or 'System.out.println("Ready to run.");'
        return "\n".join(
            [
                "import java.io.*;",
                "import java.util.*;",
                "",
                "public class Main {",
                indent_code(snippet),
                "",
                "  public static void main(String[] args) throws Exception {",
                indent_code(body, 4),
                "  }",
                "}",
            ]
        )
    if language == "c":
        body = usage or 'printf("Ready to run.\\n");'
        return "\n".join(
            [
                "#include <stdio.h>",
                "#include <stdlib.h>",
                "#include <string.h>",
                "",
                snippet,
                "",
                "int main(void) {",
                indent_code(body, 2),
                "  return 0;",
                "}",
            ]
        )
    if language == "cpp":
        body = usage or 'cout << "Ready to run." << \'\\n\';'
        return "\n".join(
            [
                "#include <bits/stdc++.h>",
                "using namespace std;",
                "",
                snippet,
                "",
                "int main() {",
                "  ios::sync_with_stdio(false);",
                "  cin.tie(nullptr);",
                indent_code(body, 2),
                "  return 0;",
                "}",
            ]
        )
    if language == "go":
        body = usage or 'fmt.Println("Ready to run.")'
        return "\n".join(
            [
                "package main",
                "",
                'import "fmt"',
                "",
                "var _ = fmt.Println",
                "",
                snippet,
                "",
                "func main() {",
                indent_code(body, 2),
                "}",
            ]
        )
    if language == "rust":
        body = usage or 'println!("Ready to run.");'
        return f'{snippet}\n\nfn main() {{\n{indent_code(body, 4)}\n}}'
    if language == "c#":
        body = usage or 'Console.WriteLine("Ready to run.");'
        return "\n".join(
            [
                "using System;",
                "using System.Collections.Generic;",
                "",
                "public class Program",
                "{",
                indent_code(snippet, 4),
                "",
                "    public static void Main()",
                "    {",
                indent_code(body, 8),
                "    }",
                "}",
            ]
        )
    if language == "kotlin":
        body = usage or 'println("Ready to run.")'
        return f'{snippet}\n\nfun main() {{\n{indent_code(body, 4)}\n}}'
    if language == "php":
        body = usage or 'echo "Ready to run." . PHP_EOL;'
        return f'<?php\n\n{snippet}\n\n{body}\n'
    if language == "ruby":
        body = usage or 'puts "Ready to run."'
        return f'{snippet}\n\n{body}\n'
    if language == "swift":
        body = usage or 'print("Ready to run.")'
        return f'import Foundation\n\n{snippet}\n\n{body}\n'
    return snippet


def build_task_snippet(task_id, language, style):
    wants_recursive = style.get("wants_recursive", False)
    wants_full_code = style.get("wants_full_code", False)

    if task_id == "add_two_numbers":
        snippet = snippet_by_language(
            language,
            {
                "python": "def add(a, b):\n    return a + b",
                "javascript": "function add(a, b) {\n  return a + b;\n}",
                "typescript": "function add(a: number, b: number): number {\n  return a + b;\n}",
                "java": "public static int add(int a, int b) {\n  return a + b;\n}",
                "c": "int add(int a, int b) {\n  return a + b;\n}",
                "cpp": "int add(int a, int b) {\n  return a + b;\n}",
                "go": "func Add(a int, b int) int {\n  return a + b\n}",
                "rust": "fn add(a: i32, b: i32) -> i32 {\n    a + b\n}",
                "c#": "public static int Add(int a, int b)\n{\n    return a + b;\n}",
            },
        )
        return apply_full_program_wrapper(task_id, language, snippet, wants_full_code)

    if task_id == "factorial":
        snippet = snippet_by_language(
            language,
            {
                "python": (
                    "def factorial(n):\n"
                    "    if n < 0:\n"
                    "        raise ValueError(\"n must be non-negative\")\n"
                    "    if n <= 1:\n"
                    "        return 1\n"
                    "    return n * factorial(n - 1)"
                    if wants_recursive
                    else
                    "def factorial(n):\n"
                    "    if n < 0:\n"
                    "        raise ValueError(\"n must be non-negative\")\n"
                    "    result = 1\n"
                    "    for i in range(2, n + 1):\n"
                    "        result *= i\n"
                    "    return result"
                ),
                "javascript": (
                    "function factorial(n) {\n  if (n < 0) throw new Error(\"n must be non-negative\");\n  if (n <= 1) return 1;\n  return n * factorial(n - 1);\n}"
                    if wants_recursive
                    else
                    "function factorial(n) {\n  if (n < 0) throw new Error(\"n must be non-negative\");\n  let result = 1;\n  for (let i = 2; i <= n; i += 1) result *= i;\n  return result;\n}"
                ),
                "typescript": (
                    "function factorial(n: number): number {\n  if (n < 0) throw new Error(\"n must be non-negative\");\n  if (n <= 1) return 1;\n  return n * factorial(n - 1);\n}"
                    if wants_recursive
                    else
                    "function factorial(n: number): number {\n  if (n < 0) throw new Error(\"n must be non-negative\");\n  let result = 1;\n  for (let i = 2; i <= n; i += 1) result *= i;\n  return result;\n}"
                ),
                "java": (
                    "public static long factorial(int n) {\n  if (n < 0) throw new IllegalArgumentException(\"n must be non-negative\");\n  if (n <= 1) return 1;\n  return n * factorial(n - 1);\n}"
                    if wants_recursive
                    else
                    "public static long factorial(int n) {\n  if (n < 0) throw new IllegalArgumentException(\"n must be non-negative\");\n  long result = 1;\n  for (int i = 2; i <= n; i++) result *= i;\n  return result;\n}"
                ),
                "c": (
                    "long long factorial(int n) {\n  if (n < 0) return -1;\n  if (n <= 1) return 1;\n  return n * factorial(n - 1);\n}"
                    if wants_recursive
                    else
                    "long long factorial(int n) {\n  if (n < 0) return -1;\n  long long result = 1;\n  for (int i = 2; i <= n; i++) result *= i;\n  return result;\n}"
                ),
                "cpp": (
                    "long long factorial(int n) {\n  if (n < 0) return -1;\n  if (n <= 1) return 1;\n  return n * factorial(n - 1);\n}"
                    if wants_recursive
                    else
                    "long long factorial(int n) {\n  if (n < 0) return -1;\n  long long result = 1;\n  for (int i = 2; i <= n; i++) result *= i;\n  return result;\n}"
                ),
                "go": (
                    "func Factorial(n int) int {\n  if n < 0 {\n    return -1\n  }\n  if n <= 1 {\n    return 1\n  }\n  return n * Factorial(n-1)\n}"
                    if wants_recursive
                    else
                    "func Factorial(n int) int {\n  if n < 0 {\n    return -1\n  }\n  result := 1\n  for i := 2; i <= n; i++ {\n    result *= i\n  }\n  return result\n}"
                ),
                "rust": (
                    "fn factorial(n: i64) -> i64 {\n    if n < 0 { return -1; }\n    if n <= 1 { return 1; }\n    n * factorial(n - 1)\n}"
                    if wants_recursive
                    else
                    "fn factorial(n: i64) -> i64 {\n    if n < 0 { return -1; }\n    let mut result = 1;\n    for i in 2..=n {\n        result *= i;\n    }\n    result\n}"
                ),
                "c#": (
                    "public static long Factorial(int n)\n{\n    if (n < 0) throw new ArgumentOutOfRangeException(nameof(n), \"n must be non-negative\");\n    if (n <= 1) return 1;\n    return n * Factorial(n - 1);\n}"
                    if wants_recursive
                    else
                    "public static long Factorial(int n)\n{\n    if (n < 0) throw new ArgumentOutOfRangeException(nameof(n), \"n must be non-negative\");\n    long result = 1;\n    for (int i = 2; i <= n; i++)\n    {\n        result *= i;\n    }\n    return result;\n}"
                ),
            },
        )
        return apply_full_program_wrapper(task_id, language, snippet, wants_full_code)

    if task_id == "gcd":
        snippet = snippet_by_language(
            language,
            {
                "python": "def gcd(a, b):\n    a = abs(a)\n    b = abs(b)\n    while b:\n        a, b = b, a % b\n    return a",
                "javascript": "function gcd(a, b) {\n  a = Math.abs(a);\n  b = Math.abs(b);\n  while (b !== 0) {\n    [a, b] = [b, a % b];\n  }\n  return a;\n}",
                "typescript": "function gcd(a: number, b: number): number {\n  a = Math.abs(a);\n  b = Math.abs(b);\n  while (b !== 0) {\n    [a, b] = [b, a % b];\n  }\n  return a;\n}",
                "java": "public static int gcd(int a, int b) {\n  a = Math.abs(a);\n  b = Math.abs(b);\n  while (b != 0) {\n    int temp = a % b;\n    a = b;\n    b = temp;\n  }\n  return a;\n}",
                "c": "int gcd(int a, int b) {\n  a = abs(a);\n  b = abs(b);\n  while (b != 0) {\n    int temp = a % b;\n    a = b;\n    b = temp;\n  }\n  return a;\n}",
                "cpp": "int gcd(int a, int b) {\n  a = abs(a);\n  b = abs(b);\n  while (b != 0) {\n    int temp = a % b;\n    a = b;\n    b = temp;\n  }\n  return a;\n}",
                "go": "func GCD(a int, b int) int {\n  if a < 0 {\n    a = -a\n  }\n  if b < 0 {\n    b = -b\n  }\n  for b != 0 {\n    a, b = b, a%b\n  }\n  return a\n}",
                "rust": "fn gcd(mut a: i64, mut b: i64) -> i64 {\n    a = a.abs();\n    b = b.abs();\n    while b != 0 {\n        let temp = a % b;\n        a = b;\n        b = temp;\n    }\n    a\n}",
                "c#": "public static int Gcd(int a, int b)\n{\n    a = Math.Abs(a);\n    b = Math.Abs(b);\n    while (b != 0)\n    {\n        int temp = a % b;\n        a = b;\n        b = temp;\n    }\n    return a;\n}",
                "kotlin": "fun gcd(a: Int, b: Int): Int {\n    var x = kotlin.math.abs(a)\n    var y = kotlin.math.abs(b)\n    while (y != 0) {\n        val temp = x % y\n        x = y\n        y = temp\n    }\n    return x\n}",
                "php": "function gcd(int $a, int $b): int {\n    $a = abs($a);\n    $b = abs($b);\n    while ($b !== 0) {\n        $temp = $a % $b;\n        $a = $b;\n        $b = $temp;\n    }\n    return $a;\n}",
                "ruby": "def gcd(a, b)\n  a = a.abs\n  b = b.abs\n  while b != 0\n    a, b = b, a % b\n  end\n  a\nend",
                "swift": "func gcd(_ a: Int, _ b: Int) -> Int {\n    var x = Swift.abs(a)\n    var y = Swift.abs(b)\n    while y != 0 {\n        let temp = x % y\n        x = y\n        y = temp\n    }\n    return x\n}",
            },
        )
        return apply_full_program_wrapper(task_id, language, snippet, wants_full_code)

    if task_id == "lcm":
        snippet = snippet_by_language(
            language,
            {
                "python": "def gcd(a, b):\n    a = abs(a)\n    b = abs(b)\n    while b:\n        a, b = b, a % b\n    return a\n\ndef lcm(a, b):\n    if a == 0 or b == 0:\n        return 0\n    return abs(a * b) // gcd(a, b)",
                "javascript": "function gcd(a, b) {\n  a = Math.abs(a);\n  b = Math.abs(b);\n  while (b !== 0) {\n    [a, b] = [b, a % b];\n  }\n  return a;\n}\n\nfunction lcm(a, b) {\n  if (a === 0 || b === 0) return 0;\n  return Math.abs(a * b) / gcd(a, b);\n}",
                "typescript": "function gcd(a: number, b: number): number {\n  a = Math.abs(a);\n  b = Math.abs(b);\n  while (b !== 0) {\n    [a, b] = [b, a % b];\n  }\n  return a;\n}\n\nfunction lcm(a: number, b: number): number {\n  if (a === 0 || b === 0) return 0;\n  return Math.abs(a * b) / gcd(a, b);\n}",
                "java": "public static int gcd(int a, int b) {\n  a = Math.abs(a);\n  b = Math.abs(b);\n  while (b != 0) {\n    int temp = a % b;\n    a = b;\n    b = temp;\n  }\n  return a;\n}\n\npublic static int lcm(int a, int b) {\n  if (a == 0 || b == 0) return 0;\n  return Math.abs(a / gcd(a, b) * b);\n}",
                "c": "int gcd(int a, int b) {\n  a = abs(a);\n  b = abs(b);\n  while (b != 0) {\n    int temp = a % b;\n    a = b;\n    b = temp;\n  }\n  return a;\n}\n\nint lcm(int a, int b) {\n  if (a == 0 || b == 0) return 0;\n  return abs((a / gcd(a, b)) * b);\n}",
                "cpp": "int gcd(int a, int b) {\n  a = abs(a);\n  b = abs(b);\n  while (b != 0) {\n    int temp = a % b;\n    a = b;\n    b = temp;\n  }\n  return a;\n}\n\nint lcm(int a, int b) {\n  if (a == 0 || b == 0) return 0;\n  return abs((a / gcd(a, b)) * b);\n}",
                "go": "func GCD(a int, b int) int {\n  if a < 0 {\n    a = -a\n  }\n  if b < 0 {\n    b = -b\n  }\n  for b != 0 {\n    a, b = b, a%b\n  }\n  return a\n}\n\nfunc LCM(a int, b int) int {\n  if a == 0 || b == 0 {\n    return 0\n  }\n  result := (a / GCD(a, b)) * b\n  if result < 0 {\n    return -result\n  }\n  return result\n}",
                "rust": "fn gcd(mut a: i64, mut b: i64) -> i64 {\n    a = a.abs();\n    b = b.abs();\n    while b != 0 {\n        let temp = a % b;\n        a = b;\n        b = temp;\n    }\n    a\n}\n\nfn lcm(a: i64, b: i64) -> i64 {\n    if a == 0 || b == 0 {\n        return 0;\n    }\n    ((a / gcd(a, b)) * b).abs()\n}",
                "c#": "public static int Gcd(int a, int b)\n{\n    a = Math.Abs(a);\n    b = Math.Abs(b);\n    while (b != 0)\n    {\n        int temp = a % b;\n        a = b;\n        b = temp;\n    }\n    return a;\n}\n\npublic static int Lcm(int a, int b)\n{\n    if (a == 0 || b == 0) return 0;\n    return Math.Abs((a / Gcd(a, b)) * b);\n}",
                "kotlin": "fun gcd(a: Int, b: Int): Int {\n    var x = kotlin.math.abs(a)\n    var y = kotlin.math.abs(b)\n    while (y != 0) {\n        val temp = x % y\n        x = y\n        y = temp\n    }\n    return x\n}\n\nfun lcm(a: Int, b: Int): Int {\n    if (a == 0 || b == 0) return 0\n    return kotlin.math.abs((a / gcd(a, b)) * b)\n}",
                "php": "function gcd(int $a, int $b): int {\n    $a = abs($a);\n    $b = abs($b);\n    while ($b !== 0) {\n        $temp = $a % $b;\n        $a = $b;\n        $b = $temp;\n    }\n    return $a;\n}\n\nfunction lcm(int $a, int $b): int {\n    if ($a === 0 || $b === 0) return 0;\n    return abs(intdiv($a, gcd($a, $b)) * $b);\n}",
                "ruby": "def gcd(a, b)\n  a = a.abs\n  b = b.abs\n  while b != 0\n    a, b = b, a % b\n  end\n  a\nend\n\ndef lcm(a, b)\n  return 0 if a == 0 || b == 0\n  ((a / gcd(a, b)) * b).abs\nend",
                "swift": "func gcd(_ a: Int, _ b: Int) -> Int {\n    var x = Swift.abs(a)\n    var y = Swift.abs(b)\n    while y != 0 {\n        let temp = x % y\n        x = y\n        y = temp\n    }\n    return x\n}\n\nfunc lcm(_ a: Int, _ b: Int) -> Int {\n    if a == 0 || b == 0 { return 0 }\n    return Swift.abs((a / gcd(a, b)) * b)\n}",
            },
        )
        return apply_full_program_wrapper(task_id, language, snippet, wants_full_code)

    if task_id == "fibonacci":
        snippet = snippet_by_language(
            language,
            {
                "python": (
                    "from functools import lru_cache\n\n@lru_cache(maxsize=None)\ndef fibonacci(n):\n    if n < 0:\n        raise ValueError(\"n must be non-negative\")\n    if n <= 1:\n        return n\n    return fibonacci(n - 1) + fibonacci(n - 2)"
                    if wants_recursive
                    else
                    "def fibonacci(n):\n    if n < 0:\n        raise ValueError(\"n must be non-negative\")\n    if n <= 1:\n        return n\n    a, b = 0, 1\n    for _ in range(2, n + 1):\n        a, b = b, a + b\n    return b"
                ),
                "javascript": (
                    "function fibonacci(n, memo = {}) {\n  if (n < 0) throw new Error(\"n must be non-negative\");\n  if (n <= 1) return n;\n  if (memo[n] !== undefined) return memo[n];\n  memo[n] = fibonacci(n - 1, memo) + fibonacci(n - 2, memo);\n  return memo[n];\n}"
                    if wants_recursive
                    else
                    "function fibonacci(n) {\n  if (n < 0) throw new Error(\"n must be non-negative\");\n  if (n <= 1) return n;\n  let a = 0, b = 1;\n  for (let i = 2; i <= n; i += 1) {\n    [a, b] = [b, a + b];\n  }\n  return b;\n}"
                ),
                "typescript": (
                    "function fibonacci(n: number, memo: Record<number, number> = {}): number {\n  if (n < 0) throw new Error(\"n must be non-negative\");\n  if (n <= 1) return n;\n  if (memo[n] !== undefined) return memo[n];\n  memo[n] = fibonacci(n - 1, memo) + fibonacci(n - 2, memo);\n  return memo[n];\n}"
                    if wants_recursive
                    else
                    "function fibonacci(n: number): number {\n  if (n < 0) throw new Error(\"n must be non-negative\");\n  if (n <= 1) return n;\n  let a = 0, b = 1;\n  for (let i = 2; i <= n; i += 1) {\n    [a, b] = [b, a + b];\n  }\n  return b;\n}"
                ),
                "java": (
                    "public static long fibonacci(int n, Map<Integer, Long> memo) {\n  if (n < 0) throw new IllegalArgumentException(\"n must be non-negative\");\n  if (n <= 1) return n;\n  if (memo.containsKey(n)) return memo.get(n);\n  long value = fibonacci(n - 1, memo) + fibonacci(n - 2, memo);\n  memo.put(n, value);\n  return value;\n}"
                    if wants_recursive
                    else
                    "public static long fibonacci(int n) {\n  if (n < 0) throw new IllegalArgumentException(\"n must be non-negative\");\n  if (n <= 1) return n;\n  long a = 0, b = 1;\n  for (int i = 2; i <= n; i++) {\n    long next = a + b;\n    a = b;\n    b = next;\n  }\n  return b;\n}"
                ),
                "c": (
                    "long long fibonacci(int n) {\n  if (n < 0) return -1;\n  if (n <= 1) return n;\n  return fibonacci(n - 1) + fibonacci(n - 2);\n}"
                    if wants_recursive
                    else
                    "long long fibonacci(int n) {\n  if (n < 0) return -1;\n  if (n <= 1) return n;\n  long long a = 0, b = 1;\n  for (int i = 2; i <= n; i++) {\n    long long next = a + b;\n    a = b;\n    b = next;\n  }\n  return b;\n}"
                ),
                "cpp": (
                    "long long fibonacci(int n, unordered_map<int, long long>& memo) {\n  if (n < 0) return -1;\n  if (n <= 1) return n;\n  if (memo.count(n)) return memo[n];\n  return memo[n] = fibonacci(n - 1, memo) + fibonacci(n - 2, memo);\n}"
                    if wants_recursive
                    else
                    "long long fibonacci(int n) {\n  if (n < 0) return -1;\n  if (n <= 1) return n;\n  long long a = 0, b = 1;\n  for (int i = 2; i <= n; i++) {\n    long long next = a + b;\n    a = b;\n    b = next;\n  }\n  return b;\n}"
                ),
                "go": (
                    "func Fibonacci(n int, memo map[int]int) int {\n  if n < 0 {\n    return -1\n  }\n  if n <= 1 {\n    return n\n  }\n  if v, ok := memo[n]; ok {\n    return v\n  }\n  memo[n] = Fibonacci(n-1, memo) + Fibonacci(n-2, memo)\n  return memo[n]\n}"
                    if wants_recursive
                    else
                    "func Fibonacci(n int) int {\n  if n < 0 {\n    return -1\n  }\n  if n <= 1 {\n    return n\n  }\n  a, b := 0, 1\n  for i := 2; i <= n; i++ {\n    a, b = b, a+b\n  }\n  return b\n}"
                ),
                "rust": (
                    "fn fibonacci(n: i64, memo: &mut std::collections::HashMap<i64, i64>) -> i64 {\n    if n < 0 { return -1; }\n    if n <= 1 { return n; }\n    if let Some(v) = memo.get(&n) { return *v; }\n    let v = fibonacci(n - 1, memo) + fibonacci(n - 2, memo);\n    memo.insert(n, v);\n    v\n}"
                    if wants_recursive
                    else
                    "fn fibonacci(n: i64) -> i64 {\n    if n < 0 { return -1; }\n    if n <= 1 { return n; }\n    let (mut a, mut b) = (0, 1);\n    for _ in 2..=n {\n        let next = a + b;\n        a = b;\n        b = next;\n    }\n    b\n}"
                ),
                "c#": (
                    "public static long Fibonacci(int n, Dictionary<int, long> memo)\n{\n    if (n < 0) throw new ArgumentOutOfRangeException(nameof(n), \"n must be non-negative\");\n    if (n <= 1) return n;\n    if (memo.TryGetValue(n, out long value)) return value;\n    value = Fibonacci(n - 1, memo) + Fibonacci(n - 2, memo);\n    memo[n] = value;\n    return value;\n}"
                    if wants_recursive
                    else
                    "public static long Fibonacci(int n)\n{\n    if (n < 0) throw new ArgumentOutOfRangeException(nameof(n), \"n must be non-negative\");\n    if (n <= 1) return n;\n    long a = 0;\n    long b = 1;\n    for (int i = 2; i <= n; i++)\n    {\n        long next = a + b;\n        a = b;\n        b = next;\n    }\n    return b;\n}"
                ),
            },
        )
        return apply_full_program_wrapper(task_id, language, snippet, wants_full_code)

    if task_id == "prime_check":
        snippet = snippet_by_language(
            language,
            {
                "python": "def is_prime(n):\n    if n <= 1:\n        return False\n    i = 2\n    while i * i <= n:\n        if n % i == 0:\n            return False\n        i += 1\n    return True",
                "javascript": "function isPrime(n) {\n  if (n <= 1) return false;\n  for (let i = 2; i * i <= n; i += 1) {\n    if (n % i === 0) return false;\n  }\n  return true;\n}",
                "typescript": "function isPrime(n: number): boolean {\n  if (n <= 1) return false;\n  for (let i = 2; i * i <= n; i += 1) {\n    if (n % i === 0) return false;\n  }\n  return true;\n}",
                "java": "public static boolean isPrime(int n) {\n  if (n <= 1) return false;\n  for (int i = 2; i * i <= n; i++) {\n    if (n % i == 0) return false;\n  }\n  return true;\n}",
                "c": "int is_prime(int n) {\n  if (n <= 1) return 0;\n  for (int i = 2; i * i <= n; i++) {\n    if (n % i == 0) return 0;\n  }\n  return 1;\n}",
                "cpp": "bool isPrime(int n) {\n  if (n <= 1) return false;\n  for (int i = 2; i * i <= n; i++) {\n    if (n % i == 0) return false;\n  }\n  return true;\n}",
                "go": "func IsPrime(n int) bool {\n  if n <= 1 {\n    return false\n  }\n  for i := 2; i*i <= n; i++ {\n    if n%i == 0 {\n      return false\n    }\n  }\n  return true\n}",
                "rust": "fn is_prime(n: i64) -> bool {\n    if n <= 1 { return false; }\n    let mut i = 2;\n    while i * i <= n {\n        if n % i == 0 { return false; }\n        i += 1;\n    }\n    true\n}",
            },
        )
        return apply_full_program_wrapper(task_id, language, snippet, wants_full_code)

    if task_id == "palindrome":
        snippet = snippet_by_language(
            language,
            {
                "python": "def is_palindrome(s):\n    left, right = 0, len(s) - 1\n    while left < right:\n        if s[left] != s[right]:\n            return False\n        left += 1\n        right -= 1\n    return True",
                "javascript": "function isPalindrome(s) {\n  let left = 0;\n  let right = s.length - 1;\n  while (left < right) {\n    if (s[left] !== s[right]) return false;\n    left += 1;\n    right -= 1;\n  }\n  return true;\n}",
                "typescript": "function isPalindrome(s: string): boolean {\n  let left = 0;\n  let right = s.length - 1;\n  while (left < right) {\n    if (s[left] !== s[right]) return false;\n    left += 1;\n    right -= 1;\n  }\n  return true;\n}",
                "java": "public static boolean isPalindrome(String s) {\n  int left = 0, right = s.length() - 1;\n  while (left < right) {\n    if (s.charAt(left) != s.charAt(right)) return false;\n    left++;\n    right--;\n  }\n  return true;\n}",
                "c": "int is_palindrome(const char* s) {\n  int left = 0;\n  int right = (int)strlen(s) - 1;\n  while (left < right) {\n    if (s[left] != s[right]) return 0;\n    left++;\n    right--;\n  }\n  return 1;\n}",
                "cpp": "bool isPalindrome(const string& s) {\n  int left = 0;\n  int right = (int)s.size() - 1;\n  while (left < right) {\n    if (s[left] != s[right]) return false;\n    left++;\n    right--;\n  }\n  return true;\n}",
                "go": "func IsPalindrome(s string) bool {\n  left, right := 0, len(s)-1\n  for left < right {\n    if s[left] != s[right] {\n      return false\n    }\n    left++\n    right--\n  }\n  return true\n}",
                "rust": "fn is_palindrome(s: &str) -> bool {\n    let bytes = s.as_bytes();\n    let (mut left, mut right) = (0usize, bytes.len().saturating_sub(1));\n    while left < right {\n        if bytes[left] != bytes[right] { return false; }\n        left += 1;\n        right = right.saturating_sub(1);\n    }\n    true\n}",
                "c#": "public static bool IsPalindrome(string s)\n{\n    int left = 0;\n    int right = s.Length - 1;\n    while (left < right)\n    {\n        if (s[left] != s[right]) return false;\n        left++;\n        right--;\n    }\n    return true;\n}",
            },
        )
        return apply_full_program_wrapper(task_id, language, snippet, wants_full_code)

    if task_id == "reverse_string":
        snippet = snippet_by_language(
            language,
            {
                "python": "def reverse_string(s):\n    return s[::-1]",
                "javascript": "function reverseString(s) {\n  return s.split(\"\").reverse().join(\"\");\n}",
                "typescript": "function reverseString(s: string): string {\n  return s.split(\"\").reverse().join(\"\");\n}",
                "java": "public static String reverseString(String s) {\n  return new StringBuilder(s).reverse().toString();\n}",
                "c": "void reverse_string(char* s) {\n  int left = 0;\n  int right = (int)strlen(s) - 1;\n  while (left < right) {\n    char tmp = s[left];\n    s[left] = s[right];\n    s[right] = tmp;\n    left++;\n    right--;\n  }\n}",
                "cpp": "string reverseString(string s) {\n  reverse(s.begin(), s.end());\n  return s;\n}",
                "go": "func ReverseString(s string) string {\n  runes := []rune(s)\n  for left, right := 0, len(runes)-1; left < right; left, right = left+1, right-1 {\n    runes[left], runes[right] = runes[right], runes[left]\n  }\n  return string(runes)\n}",
                "rust": "fn reverse_string(s: &str) -> String {\n    s.chars().rev().collect()\n}",
                "c#": "public static string ReverseString(string s)\n{\n    char[] chars = s.ToCharArray();\n    Array.Reverse(chars);\n    return new string(chars);\n}",
            },
        )
        return apply_full_program_wrapper(task_id, language, snippet, wants_full_code)

    if task_id == "binary_search":
        snippet = snippet_by_language(
            language,
            {
                "python": "def binary_search(arr, target):\n    left, right = 0, len(arr) - 1\n    while left <= right:\n        mid = (left + right) // 2\n        if arr[mid] == target:\n            return mid\n        if arr[mid] < target:\n            left = mid + 1\n        else:\n            right = mid - 1\n    return -1",
                "javascript": "function binarySearch(arr, target) {\n  let left = 0;\n  let right = arr.length - 1;\n  while (left <= right) {\n    const mid = Math.floor((left + right) / 2);\n    if (arr[mid] === target) return mid;\n    if (arr[mid] < target) left = mid + 1;\n    else right = mid - 1;\n  }\n  return -1;\n}",
                "typescript": "function binarySearch(arr: number[], target: number): number {\n  let left = 0;\n  let right = arr.length - 1;\n  while (left <= right) {\n    const mid = Math.floor((left + right) / 2);\n    if (arr[mid] === target) return mid;\n    if (arr[mid] < target) left = mid + 1;\n    else right = mid - 1;\n  }\n  return -1;\n}",
                "java": "public static int binarySearch(int[] arr, int target) {\n  int left = 0, right = arr.length - 1;\n  while (left <= right) {\n    int mid = left + (right - left) / 2;\n    if (arr[mid] == target) return mid;\n    if (arr[mid] < target) left = mid + 1;\n    else right = mid - 1;\n  }\n  return -1;\n}",
                "c": "int binary_search(int arr[], int n, int target) {\n  int left = 0, right = n - 1;\n  while (left <= right) {\n    int mid = left + (right - left) / 2;\n    if (arr[mid] == target) return mid;\n    if (arr[mid] < target) left = mid + 1;\n    else right = mid - 1;\n  }\n  return -1;\n}",
                "cpp": "int binarySearch(const vector<int>& arr, int target) {\n  int left = 0, right = (int)arr.size() - 1;\n  while (left <= right) {\n    int mid = left + (right - left) / 2;\n    if (arr[mid] == target) return mid;\n    if (arr[mid] < target) left = mid + 1;\n    else right = mid - 1;\n  }\n  return -1;\n}",
                "go": "func BinarySearch(arr []int, target int) int {\n  left, right := 0, len(arr)-1\n  for left <= right {\n    mid := left + (right-left)/2\n    if arr[mid] == target {\n      return mid\n    }\n    if arr[mid] < target {\n      left = mid + 1\n    } else {\n      right = mid - 1\n    }\n  }\n  return -1\n}",
                "rust": "fn binary_search(arr: &[i32], target: i32) -> i32 {\n    let (mut left, mut right) = (0i32, arr.len() as i32 - 1);\n    while left <= right {\n        let mid = left + (right - left) / 2;\n        let value = arr[mid as usize];\n        if value == target { return mid; }\n        if value < target { left = mid + 1; }\n        else { right = mid - 1; }\n    }\n    -1\n}",
                "c#": "public static int BinarySearch(int[] arr, int target)\n{\n    int left = 0;\n    int right = arr.Length - 1;\n    while (left <= right)\n    {\n        int mid = left + (right - left) / 2;\n        if (arr[mid] == target) return mid;\n        if (arr[mid] < target) left = mid + 1;\n        else right = mid - 1;\n    }\n    return -1;\n}",
            },
        )
        return apply_full_program_wrapper(task_id, language, snippet, wants_full_code)

    if task_id == "sort_array":
        snippet = snippet_by_language(
            language,
            {
                "python": "def sort_array(arr):\n    return sorted(arr)",
                "javascript": "function sortArray(arr) {\n  return [...arr].sort((a, b) => a - b);\n}",
                "typescript": "function sortArray(arr: number[]): number[] {\n  return [...arr].sort((a, b) => a - b);\n}",
                "java": "public static int[] sortArray(int[] arr) {\n  int[] copy = Arrays.copyOf(arr, arr.length);\n  Arrays.sort(copy);\n  return copy;\n}",
                "c": "void sort_array(int arr[], int n) {\n  for (int i = 0; i < n - 1; i++) {\n    for (int j = 0; j < n - i - 1; j++) {\n      if (arr[j] > arr[j + 1]) {\n        int tmp = arr[j];\n        arr[j] = arr[j + 1];\n        arr[j + 1] = tmp;\n      }\n    }\n  }\n}",
                "cpp": "vector<int> sortArray(vector<int> arr) {\n  sort(arr.begin(), arr.end());\n  return arr;\n}",
                "go": "func SortArray(arr []int) []int {\n  out := append([]int{}, arr...)\n  sort.Ints(out)\n  return out\n}",
                "rust": "fn sort_array(mut arr: Vec<i32>) -> Vec<i32> {\n    arr.sort();\n    arr\n}",
            },
        )
        return apply_full_program_wrapper(task_id, language, snippet, wants_full_code)

    if task_id == "two_sum":
        snippet = snippet_by_language(
            language,
            {
                "python": "def two_sum(nums, target):\n    seen = {}\n    for i, x in enumerate(nums):\n        need = target - x\n        if need in seen:\n            return [seen[need], i]\n        seen[x] = i\n    return []",
                "javascript": "function twoSum(nums, target) {\n  const seen = new Map();\n  for (let i = 0; i < nums.length; i += 1) {\n    const need = target - nums[i];\n    if (seen.has(need)) return [seen.get(need), i];\n    seen.set(nums[i], i);\n  }\n  return [];\n}",
                "typescript": "function twoSum(nums: number[], target: number): number[] {\n  const seen = new Map<number, number>();\n  for (let i = 0; i < nums.length; i += 1) {\n    const need = target - nums[i];\n    if (seen.has(need)) return [seen.get(need) as number, i];\n    seen.set(nums[i], i);\n  }\n  return [];\n}",
                "java": "public static int[] twoSum(int[] nums, int target) {\n  Map<Integer, Integer> seen = new HashMap<>();\n  for (int i = 0; i < nums.length; i++) {\n    int need = target - nums[i];\n    if (seen.containsKey(need)) return new int[]{seen.get(need), i};\n    seen.put(nums[i], i);\n  }\n  return new int[]{};\n}",
                "c": "int two_sum(int nums[], int n, int target, int* i1, int* i2) {\n  for (int i = 0; i < n; i++) {\n    for (int j = i + 1; j < n; j++) {\n      if (nums[i] + nums[j] == target) {\n        *i1 = i;\n        *i2 = j;\n        return 1;\n      }\n    }\n  }\n  return 0;\n}",
                "cpp": "vector<int> twoSum(vector<int>& nums, int target) {\n  unordered_map<int, int> seen;\n  for (int i = 0; i < (int)nums.size(); i++) {\n    int need = target - nums[i];\n    if (seen.count(need)) return {seen[need], i};\n    seen[nums[i]] = i;\n  }\n  return {};\n}",
                "go": "func TwoSum(nums []int, target int) []int {\n  seen := map[int]int{}\n  for i, x := range nums {\n    need := target - x\n    if j, ok := seen[need]; ok {\n      return []int{j, i}\n    }\n    seen[x] = i\n  }\n  return []int{}\n}",
                "rust": "fn two_sum(nums: &[i32], target: i32) -> Vec<usize> {\n    let mut seen = std::collections::HashMap::new();\n    for (i, &x) in nums.iter().enumerate() {\n      let need = target - x;\n      if let Some(&j) = seen.get(&need) {\n        return vec![j, i];\n      }\n      seen.insert(x, i);\n    }\n    vec![]\n}",
                "c#": "public static int[] TwoSum(int[] nums, int target)\n{\n    var seen = new Dictionary<int, int>();\n    for (int i = 0; i < nums.Length; i++)\n    {\n        int need = target - nums[i];\n        if (seen.TryGetValue(need, out int index)) return new[] { index, i };\n        seen[nums[i]] = i;\n    }\n    return Array.Empty<int>();\n}",
            },
        )
        return apply_full_program_wrapper(task_id, language, snippet, wants_full_code)

    if task_id == "longest_substring_no_repeat":
        snippet = snippet_by_language(
            language,
            {
                "python": "def length_of_longest_substring(s):\n    last = {}\n    left = 0\n    best = 0\n    for right, ch in enumerate(s):\n        if ch in last and last[ch] >= left:\n            left = last[ch] + 1\n        last[ch] = right\n        best = max(best, right - left + 1)\n    return best",
                "javascript": "function lengthOfLongestSubstring(s) {\n  const last = new Map();\n  let left = 0;\n  let best = 0;\n  for (let right = 0; right < s.length; right += 1) {\n    const ch = s[right];\n    if (last.has(ch) && last.get(ch) >= left) {\n      left = last.get(ch) + 1;\n    }\n    last.set(ch, right);\n    best = Math.max(best, right - left + 1);\n  }\n  return best;\n}",
                "typescript": "function lengthOfLongestSubstring(s: string): number {\n  const last = new Map<string, number>();\n  let left = 0;\n  let best = 0;\n  for (let right = 0; right < s.length; right += 1) {\n    const ch = s[right];\n    if (last.has(ch) && (last.get(ch) as number) >= left) {\n      left = (last.get(ch) as number) + 1;\n    }\n    last.set(ch, right);\n    best = Math.max(best, right - left + 1);\n  }\n  return best;\n}",
                "java": "public static int lengthOfLongestSubstring(String s) {\n  Map<Character, Integer> last = new HashMap<>();\n  int left = 0;\n  int best = 0;\n  for (int right = 0; right < s.length(); right++) {\n    char ch = s.charAt(right);\n    if (last.containsKey(ch) && last.get(ch) >= left) {\n      left = last.get(ch) + 1;\n    }\n    last.put(ch, right);\n    best = Math.max(best, right - left + 1);\n  }\n  return best;\n}",
                "cpp": "int lengthOfLongestSubstring(const string& s) {\n  unordered_map<char, int> last;\n  int left = 0;\n  int best = 0;\n  for (int right = 0; right < (int)s.size(); right++) {\n    char ch = s[right];\n    if (last.count(ch) && last[ch] >= left) {\n      left = last[ch] + 1;\n    }\n    last[ch] = right;\n    best = max(best, right - left + 1);\n  }\n  return best;\n}",
            },
        )
        return apply_full_program_wrapper(task_id, language, snippet, wants_full_code)

    if task_id == "maximum_subarray":
        snippet = snippet_by_language(
            language,
            {
                "python": "def max_subarray(nums):\n    best = nums[0]\n    current = nums[0]\n    for x in nums[1:]:\n        current = max(x, current + x)\n        best = max(best, current)\n    return best",
                "javascript": "function maxSubArray(nums) {\n  let best = nums[0];\n  let current = nums[0];\n  for (let i = 1; i < nums.length; i += 1) {\n    current = Math.max(nums[i], current + nums[i]);\n    best = Math.max(best, current);\n  }\n  return best;\n}",
                "typescript": "function maxSubArray(nums: number[]): number {\n  let best = nums[0];\n  let current = nums[0];\n  for (let i = 1; i < nums.length; i += 1) {\n    current = Math.max(nums[i], current + nums[i]);\n    best = Math.max(best, current);\n  }\n  return best;\n}",
                "java": "public static int maxSubArray(int[] nums) {\n  int best = nums[0];\n  int current = nums[0];\n  for (int i = 1; i < nums.length; i++) {\n    current = Math.max(nums[i], current + nums[i]);\n    best = Math.max(best, current);\n  }\n  return best;\n}",
                "cpp": "int maxSubArray(vector<int>& nums) {\n  int best = nums[0];\n  int current = nums[0];\n  for (int i = 1; i < (int)nums.size(); i++) {\n    current = max(nums[i], current + nums[i]);\n    best = max(best, current);\n  }\n  return best;\n}",
            },
        )
        return apply_full_program_wrapper(task_id, language, snippet, wants_full_code)

    if task_id == "merge_intervals":
        snippet = snippet_by_language(
            language,
            {
                "python": "def merge(intervals):\n    intervals.sort()\n    merged = []\n    for start, end in intervals:\n        if not merged or merged[-1][1] < start:\n            merged.append([start, end])\n        else:\n            merged[-1][1] = max(merged[-1][1], end)\n    return merged",
                "javascript": "function merge(intervals) {\n  intervals.sort((a, b) => a[0] - b[0]);\n  const merged = [];\n  for (const [start, end] of intervals) {\n    if (merged.length === 0 || merged[merged.length - 1][1] < start) {\n      merged.push([start, end]);\n    } else {\n      merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], end);\n    }\n  }\n  return merged;\n}",
                "typescript": "function merge(intervals: number[][]): number[][] {\n  intervals.sort((a, b) => a[0] - b[0]);\n  const merged: number[][] = [];\n  for (const [start, end] of intervals) {\n    if (merged.length === 0 || merged[merged.length - 1][1] < start) {\n      merged.push([start, end]);\n    } else {\n      merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], end);\n    }\n  }\n  return merged;\n}",
                "java": "public static int[][] merge(int[][] intervals) {\n  Arrays.sort(intervals, Comparator.comparingInt(a -> a[0]));\n  List<int[]> merged = new ArrayList<>();\n  for (int[] interval : intervals) {\n    if (merged.isEmpty() || merged.get(merged.size() - 1)[1] < interval[0]) {\n      merged.add(new int[]{interval[0], interval[1]});\n    } else {\n      merged.get(merged.size() - 1)[1] = Math.max(merged.get(merged.size() - 1)[1], interval[1]);\n    }\n  }\n  return merged.toArray(new int[merged.size()][]);\n}",
                "cpp": "vector<vector<int>> merge(vector<vector<int>>& intervals) {\n  sort(intervals.begin(), intervals.end());\n  vector<vector<int>> merged;\n  for (const auto& interval : intervals) {\n    if (merged.empty() || merged.back()[1] < interval[0]) {\n      merged.push_back(interval);\n    } else {\n      merged.back()[1] = max(merged.back()[1], interval[1]);\n    }\n  }\n  return merged;\n}",
                "c#": "public static int[][] Merge(int[][] intervals)\n{\n    Array.Sort(intervals, (a, b) => a[0].CompareTo(b[0]));\n    var merged = new List<int[]>();\n    foreach (var interval in intervals)\n    {\n        if (merged.Count == 0 || merged[^1][1] < interval[0])\n        {\n            merged.Add(new[] { interval[0], interval[1] });\n        }\n        else\n        {\n            merged[^1][1] = Math.Max(merged[^1][1], interval[1]);\n        }\n    }\n    return merged.ToArray();\n}",
            },
        )
        return apply_full_program_wrapper(task_id, language, snippet, wants_full_code)

    if task_id == "subarray_sum_k":
        snippet = snippet_by_language(
            language,
            {
                "python": "def subarray_sum(nums, k):\n    count = 0\n    prefix = 0\n    seen = {0: 1}\n    for x in nums:\n        prefix += x\n        count += seen.get(prefix - k, 0)\n        seen[prefix] = seen.get(prefix, 0) + 1\n    return count",
                "javascript": "function subarraySum(nums, k) {\n  let count = 0;\n  let prefix = 0;\n  const seen = new Map([[0, 1]]);\n  for (const x of nums) {\n    prefix += x;\n    count += seen.get(prefix - k) || 0;\n    seen.set(prefix, (seen.get(prefix) || 0) + 1);\n  }\n  return count;\n}",
                "typescript": "function subarraySum(nums: number[], k: number): number {\n  let count = 0;\n  let prefix = 0;\n  const seen = new Map<number, number>([[0, 1]]);\n  for (const x of nums) {\n    prefix += x;\n    count += seen.get(prefix - k) || 0;\n    seen.set(prefix, (seen.get(prefix) || 0) + 1);\n  }\n  return count;\n}",
                "java": "public static int subarraySum(int[] nums, int k) {\n  Map<Integer, Integer> seen = new HashMap<>();\n  seen.put(0, 1);\n  int count = 0;\n  int prefix = 0;\n  for (int x : nums) {\n    prefix += x;\n    count += seen.getOrDefault(prefix - k, 0);\n    seen.put(prefix, seen.getOrDefault(prefix, 0) + 1);\n  }\n  return count;\n}",
                "cpp": "int subarraySum(vector<int>& nums, int k) {\n  unordered_map<int, int> seen;\n  seen[0] = 1;\n  int count = 0;\n  int prefix = 0;\n  for (int x : nums) {\n    prefix += x;\n    count += seen[prefix - k];\n    seen[prefix] += 1;\n  }\n  return count;\n}",
            },
        )
        return apply_full_program_wrapper(task_id, language, snippet, wants_full_code)

    if task_id == "trie":
        snippet = snippet_by_language(
            language,
            {
                "python": "class TrieNode:\n    def __init__(self):\n        self.children = {}\n        self.is_end = False\n\nclass Trie:\n    def __init__(self):\n        self.root = TrieNode()\n\n    def insert(self, word):\n        node = self.root\n        for ch in word:\n            node = node.children.setdefault(ch, TrieNode())\n        node.is_end = True\n\n    def search(self, word):\n        node = self.root\n        for ch in word:\n            if ch not in node.children:\n                return False\n            node = node.children[ch]\n        return node.is_end\n\n    def starts_with(self, prefix):\n        node = self.root\n        for ch in prefix:\n            if ch not in node.children:\n                return False\n            node = node.children[ch]\n        return True",
                "java": "static class TrieNode {\n  Map<Character, TrieNode> children = new HashMap<>();\n  boolean isEnd;\n}\n\nstatic class Trie {\n  private final TrieNode root = new TrieNode();\n\n  void insert(String word) {\n    TrieNode node = root;\n    for (char ch : word.toCharArray()) {\n      node = node.children.computeIfAbsent(ch, key -> new TrieNode());\n    }\n    node.isEnd = true;\n  }\n\n  boolean search(String word) {\n    TrieNode node = root;\n    for (char ch : word.toCharArray()) {\n      node = node.children.get(ch);\n      if (node == null) return false;\n    }\n    return node.isEnd;\n  }\n\n  boolean startsWith(String prefix) {\n    TrieNode node = root;\n    for (char ch : prefix.toCharArray()) {\n      node = node.children.get(ch);\n      if (node == null) return false;\n    }\n    return true;\n  }\n}",
                "javascript": "class TrieNode {\n  constructor() {\n    this.children = new Map();\n    this.isEnd = false;\n  }\n}\n\nclass Trie {\n  constructor() {\n    this.root = new TrieNode();\n  }\n\n  insert(word) {\n    let node = this.root;\n    for (const ch of word) {\n      if (!node.children.has(ch)) node.children.set(ch, new TrieNode());\n      node = node.children.get(ch);\n    }\n    node.isEnd = true;\n  }\n\n  search(word) {\n    let node = this.root;\n    for (const ch of word) {\n      if (!node.children.has(ch)) return false;\n      node = node.children.get(ch);\n    }\n    return node.isEnd;\n  }\n\n  startsWith(prefix) {\n    let node = this.root;\n    for (const ch of prefix) {\n      if (!node.children.has(ch)) return false;\n      node = node.children.get(ch);\n    }\n    return true;\n  }\n}",
                "cpp": "class TrieNode {\n public:\n  unordered_map<char, TrieNode*> children;\n  bool isEnd = false;\n};\n\nclass Trie {\n public:\n  Trie() : root(new TrieNode()) {}\n\n  void insert(const string& word) {\n    TrieNode* node = root;\n    for (char ch : word) {\n      if (!node->children.count(ch)) node->children[ch] = new TrieNode();\n      node = node->children[ch];\n    }\n    node->isEnd = true;\n  }\n\n  bool search(const string& word) const {\n    TrieNode* node = root;\n    for (char ch : word) {\n      if (!node->children.count(ch)) return false;\n      node = node->children.at(ch);\n    }\n    return node->isEnd;\n  }\n\n  bool startsWith(const string& prefix) const {\n    TrieNode* node = root;\n    for (char ch : prefix) {\n      if (!node->children.count(ch)) return false;\n      node = node->children.at(ch);\n    }\n    return true;\n  }\n\n private:\n  TrieNode* root;\n};",
            },
        )
        return apply_full_program_wrapper(task_id, language, snippet, wants_full_code)

    if task_id == "binary_tree":
        snippet = snippet_by_language(
            language,
            {
                "python": (
                    "class Node:\n"
                    "    def __init__(self, value):\n"
                    "        self.value = value\n"
                    "        self.left = None\n"
                    "        self.right = None\n\n"
                    "def insert(root, value):\n"
                    "    if root is None:\n"
                    "        return Node(value)\n"
                    "    if value < root.value:\n"
                    "        root.left = insert(root.left, value)\n"
                    "    else:\n"
                    "        root.right = insert(root.right, value)\n"
                    "    return root\n\n"
                    "def inorder(root):\n"
                    "    if root is None:\n"
                    "        return\n"
                    "    inorder(root.left)\n"
                    "    print(root.value, end=' ')\n"
                    "    inorder(root.right)\n"
                ),
                "javascript": (
                    "class Node {\n"
                    "  constructor(value) {\n"
                    "    this.value = value;\n"
                    "    this.left = null;\n"
                    "    this.right = null;\n"
                    "  }\n"
                    "}\n\n"
                    "function insert(root, value) {\n"
                    "  if (!root) return new Node(value);\n"
                    "  if (value < root.value) root.left = insert(root.left, value);\n"
                    "  else root.right = insert(root.right, value);\n"
                    "  return root;\n"
                    "}\n\n"
                    "function inorder(root, out = []) {\n"
                    "  if (!root) return out;\n"
                    "  inorder(root.left, out);\n"
                    "  out.push(root.value);\n"
                    "  inorder(root.right, out);\n"
                    "  return out;\n"
                    "}\n"
                ),
                "typescript": (
                    "class Node {\n"
                    "  value: number;\n"
                    "  left: Node | null = null;\n"
                    "  right: Node | null = null;\n\n"
                    "  constructor(value: number) {\n"
                    "    this.value = value;\n"
                    "  }\n"
                    "}\n\n"
                    "function insert(root: Node | null, value: number): Node {\n"
                    "  if (!root) return new Node(value);\n"
                    "  if (value < root.value) root.left = insert(root.left, value);\n"
                    "  else root.right = insert(root.right, value);\n"
                    "  return root;\n"
                    "}\n"
                ),
                "java": (
                    "public class Main {\n"
                    "  static class Node {\n"
                    "    int value;\n"
                    "    Node left, right;\n"
                    "    Node(int value) { this.value = value; }\n"
                    "  }\n\n"
                    "  static Node insert(Node root, int value) {\n"
                    "    if (root == null) return new Node(value);\n"
                    "    if (value < root.value) root.left = insert(root.left, value);\n"
                    "    else root.right = insert(root.right, value);\n"
                    "    return root;\n"
                    "  }\n"
                    "}\n"
                ),
                "c": (
                    "#include <stdio.h>\n#include <stdlib.h>\n\n"
                    "typedef struct Node {\n"
                    "  int value;\n"
                    "  struct Node* left;\n"
                    "  struct Node* right;\n"
                    "} Node;\n"
                ),
                "cpp": (
                    "#include <bits/stdc++.h>\nusing namespace std;\n\n"
                    "struct Node {\n"
                    "  int value;\n"
                    "  Node* left;\n"
                    "  Node* right;\n"
                    "  explicit Node(int value) : value(value), left(nullptr), right(nullptr) {}\n"
                    "};\n"
                ),
                "go": (
                    "package main\n\nimport \"fmt\"\n\n"
                    "type Node struct {\n"
                    "  Value int\n"
                    "  Left  *Node\n"
                    "  Right *Node\n"
                    "}\n"
                ),
                "rust": (
                    "#[derive(Debug)]\n"
                    "struct Node {\n"
                    "    value: i32,\n"
                    "    left: Option<Box<Node>>,\n"
                    "    right: Option<Box<Node>>,\n"
                    "}\n"
                ),
            },
        )
        return apply_full_program_wrapper(task_id, language, snippet, wants_full_code)

    if task_id == "pos_tagging":
        snippet = snippet_by_language(
            language,
            {
                "python": (
                    "import nltk\n"
                    "from nltk import pos_tag, word_tokenize\n\n"
                    "# Run once:\n"
                    "# nltk.download('punkt')\n"
                    "# nltk.download('averaged_perceptron_tagger')\n\n"
                    "def pos_tag_sentence(sentence: str):\n"
                    "    tokens = word_tokenize(sentence)\n"
                    "    return pos_tag(tokens)\n\n"
                    "if __name__ == \"__main__\":\n"
                    "    text = input().strip()\n"
                    "    print(pos_tag_sentence(text))"
                ),
                "javascript": "const nlp = require('compromise');\n\nfunction posTagSentence(sentence) {\n  return nlp(sentence).terms().json();\n}",
                "typescript": "function posTagSentence(sentence: string) {\n  return sentence;\n}",
                "java": "/* Java POS tagging is commonly done with Stanford CoreNLP or OpenNLP. */",
                "c": "/* C typically calls an external NLP model or service for POS tagging. */",
                "cpp": "/* C++ POS tagging usually integrates external NLP libraries or ONNX models. */",
                "go": "/* Go POS tagging generally uses external NLP services or ML model bindings. */",
                "rust": "/* Rust POS tagging usually integrates external NLP crates or models. */",
            },
        )
        return apply_full_program_wrapper(task_id, language, snippet, wants_full_code)

    if task_id == "django_login_api":
        return "\n".join(
            [
                "from django.contrib.auth import authenticate",
                "from rest_framework import status",
                "from rest_framework.authtoken.models import Token",
                "from rest_framework.decorators import api_view, permission_classes",
                "from rest_framework.permissions import AllowAny",
                "from rest_framework.response import Response",
                "",
                "@api_view([\"POST\"])",
                "@permission_classes([AllowAny])",
                "def login_view(request):",
                "    username = (request.data.get(\"username\") or \"\").strip()",
                "    password = request.data.get(\"password\") or \"\"",
                "",
                "    user = authenticate(request, username=username, password=password)",
                "    if user is None:",
                '        return Response({"detail": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)',
                "",
                "    token, _ = Token.objects.get_or_create(user=user)",
                "    return Response(",
                "        {",
                '            "token": token.key,',
                '            "user": {"id": user.id, "username": user.get_username()},',
                "        }",
                "    )",
            ]
        )

    if task_id == "django_rest_api":
        return "\n".join(
            [
                "# models.py",
                "from django.db import models",
                "",
                "class Item(models.Model):",
                "    name = models.CharField(max_length=120)",
                "    description = models.TextField(blank=True)",
                "",
                "# serializers.py",
                "from rest_framework import serializers",
                "",
                "class ItemSerializer(serializers.ModelSerializer):",
                "    class Meta:",
                "        model = Item",
                '        fields = ["id", "name", "description"]',
                "",
                "# views.py",
                "from rest_framework.viewsets import ModelViewSet",
                "",
                "class ItemViewSet(ModelViewSet):",
                "    queryset = Item.objects.all().order_by(\"id\")",
                "    serializer_class = ItemSerializer",
                "",
                "# urls.py",
                "from django.urls import include, path",
                "from rest_framework.routers import DefaultRouter",
                "",
                "router = DefaultRouter()",
                'router.register(\"items\", ItemViewSet, basename=\"item\")',
                "",
                "urlpatterns = [",
                '    path(\"api/\", include(router.urls)),',
                "]",
            ]
        )

    snippet = build_generic_topic_snippet(style.get("topic_text", task_id), language)
    return apply_full_program_wrapper(task_id, language, snippet, wants_full_code)


def build_alternative_snippet(task_id, language, style):
    if task_id in {"factorial", "fibonacci"}:
        flipped = dict(style)
        flipped["wants_recursive"] = not style.get("wants_recursive", False)
        return build_task_snippet(task_id, language, flipped)
    return ""


def infer_contest_technique(problem_text):
    lowered = normalize_space(problem_text).lower()
    if re.search(r"\bsubarray\b.*\bsum\b", lowered):
        return {
            "label": "prefix sums with a hash map",
            "complexity": "O(n) time when the target relation can be tracked from prefix state",
            "steps": [
                "Define the running state for each prefix.",
                "Store the frequency or earliest index of previously seen prefix states.",
                "Update the answer using the difference between current state and target condition.",
            ],
        }
    if re.search(r"\bsubstring\b|\bwindow\b", lowered):
        return {
            "label": "sliding window",
            "complexity": "O(n) time if the window only moves forward",
            "steps": [
                "Maintain a left and right pointer.",
                "Track the condition that makes the current window valid or invalid.",
                "Expand or shrink the window while updating the best answer.",
            ],
        }
    if re.search(r"\bshortest path\b|\bdijkstra\b|\bweighted graph\b", lowered):
        return {
            "label": "graph shortest path",
            "complexity": "O((n + m) log n) with adjacency lists and a priority queue",
            "steps": [
                "Build the graph from the input format.",
                "Initialize distances and push the source into a min-heap.",
                "Relax edges and ignore stale heap entries.",
            ],
        }
    if re.search(r"\bprerequisite\b|\bcourse schedule\b|\btopological\b|\bdag\b", lowered):
        return {
            "label": "topological ordering on a directed graph",
            "complexity": "O(n + m) time",
            "steps": [
                "Build adjacency lists and indegree counts.",
                "Push all zero-indegree nodes into a queue.",
                "Pop nodes, relax outgoing edges, and verify all nodes are processed.",
            ],
        }
    if re.search(r"\bgraph\b|\btree\b|\bgrid\b|\bmaze\b", lowered):
        return {
            "label": "graph traversal",
            "complexity": "Usually O(n + m) for graph traversal or O(rows * cols) for grids",
            "steps": [
                "Model states and neighbors carefully.",
                "Choose BFS for shortest paths in unweighted graphs and DFS for reachability or structure.",
                "Track visited state to avoid repeated work.",
            ],
        }
    if re.search(r"\bdp\b|\bdynamic programming\b|\bcoin change\b|\bknapsack\b|\blis\b", lowered):
        return {
            "label": "dynamic programming",
            "complexity": "Depends on state count and transition cost",
            "steps": [
                "Define the DP state precisely.",
                "Write the recurrence and base cases before coding.",
                "Compress memory only after the recurrence is correct.",
            ],
        }
    return {
        "label": "constraint-driven algorithm selection",
        "complexity": "Choose the best target from the input limits, usually O(n), O(n log n), or O(n + m)",
        "steps": [
            "Read the constraints first and reject any brute-force plan that exceeds them.",
            "Identify the dominant structure: array/string, graph/tree, interval set, or DP state.",
            "Pick the simplest algorithm that satisfies the limits and preserves correctness.",
        ],
    }


def build_generic_contest_template(language):
    templates = {
        "python": "\n".join(
            [
                "def solve():",
                "    import sys",
                "    data = sys.stdin.read().strip().split()",
                "    if not data:",
                "        return",
                "    # parse input",
                "    # implement the chosen algorithm",
                "    answer = 0",
                "    print(answer)",
                "",
                "if __name__ == \"__main__\":",
                "    solve()",
            ]
        ),
        "javascript": "\n".join(
            [
                "function solve(input) {",
                "  const data = input.trim().split(/\\s+/);",
                "  if (data.length === 0 || data[0] === \"\") return \"\";",
                "  // parse input",
                "  // implement the chosen algorithm",
                "  const answer = 0;",
                "  return String(answer);",
                "}",
                "",
                "const fs = require(\"fs\");",
                "const input = fs.readFileSync(0, \"utf8\");",
                "const out = solve(input);",
                "if (out.length) process.stdout.write(out + \"\\n\");",
            ]
        ),
        "typescript": "\n".join(
            [
                "function solve(input: string): string {",
                "  const data = input.trim().split(/\\s+/);",
                "  if (data.length === 0 || data[0] === \"\") return \"\";",
                "  // parse input",
                "  // implement the chosen algorithm",
                "  const answer = 0;",
                "  return String(answer);",
                "}",
                "",
                "import * as fs from \"fs\";",
                "const input = fs.readFileSync(0, \"utf8\");",
                "const out = solve(input);",
                "if (out.length) process.stdout.write(out + \"\\n\");",
            ]
        ),
        "java": "\n".join(
            [
                "import java.io.*;",
                "import java.util.*;",
                "",
                "public class Main {",
                "  static void solve(FastScanner fs) throws Exception {",
                "    // parse input",
                "    // implement the chosen algorithm",
                "    int answer = 0;",
                "    System.out.println(answer);",
                "  }",
                "",
                "  public static void main(String[] args) throws Exception {",
                "    FastScanner fs = new FastScanner(System.in);",
                "    solve(fs);",
                "  }",
                "",
                "  static class FastScanner {",
                "    private final InputStream in;",
                "    private final byte[] buffer = new byte[1 << 16];",
                "    private int ptr = 0, len = 0;",
                "    FastScanner(InputStream is) { in = is; }",
                "  }",
                "}",
            ]
        ),
        "c": "\n".join(
            [
                "#include <stdio.h>",
                "",
                "int main(void) {",
                "  // parse input",
                "  // implement the chosen algorithm",
                "  int answer = 0;",
                "  printf(\"%d\\n\", answer);",
                "  return 0;",
                "}",
            ]
        ),
        "cpp": "\n".join(
            [
                "#include <bits/stdc++.h>",
                "using namespace std;",
                "",
                "int main() {",
                "  ios::sync_with_stdio(false);",
                "  cin.tie(nullptr);",
                "  // parse input",
                "  // implement the chosen algorithm",
                "  int answer = 0;",
                "  cout << answer << '\\n';",
                "  return 0;",
                "}",
            ]
        ),
        "go": "\n".join(
            [
                "package main",
                "",
                "import (",
                '  "bufio"',
                '  "fmt"',
                '  "os"',
                ")",
                "",
                "func main() {",
                "  in := bufio.NewReader(os.Stdin)",
                "  _ = in",
                "  // parse input",
                "  // implement the chosen algorithm",
                "  answer := 0",
                "  fmt.Println(answer)",
                "}",
            ]
        ),
        "rust": "\n".join(
            [
                "fn solve() {",
                "    // parse input",
                "    // implement the chosen algorithm",
                "    let answer = 0;",
                "    println!(\"{}\", answer);",
                "}",
                "",
                "fn main() {",
                "    solve();",
                "}",
            ]
        ),
        "c#": "\n".join(
            [
                "using System;",
                "",
                "public class Program",
                "{",
                "    public static void Main()",
                "    {",
                "        // parse input",
                "        // implement the chosen algorithm",
                "        int answer = 0;",
                "        Console.WriteLine(answer);",
                "    }",
                "}",
            ]
        ),
        "kotlin": "\n".join(
            [
                "fun main() {",
                "    // parse input",
                "    // implement the chosen algorithm",
                "    val answer = 0",
                "    println(answer)",
                "}",
            ]
        ),
        "php": "\n".join(
            [
                "<?php",
                "// parse input",
                "// implement the chosen algorithm",
                "$answer = 0;",
                "echo $answer . PHP_EOL;",
                "?>",
            ]
        ),
        "ruby": "\n".join(
            [
                "# parse input",
                "# implement the chosen algorithm",
                "answer = 0",
                "puts answer",
            ]
        ),
        "swift": "\n".join(
            [
                "import Foundation",
                "",
                "// parse input",
                "// implement the chosen algorithm",
                "let answer = 0",
                "print(answer)",
            ]
        ),
    }
    return templates.get(language, templates["python"])


def coding_support_response():
    return "\n".join(
        [
            "I can generate coding logic based on your exact question.",
            "",
            "Supported major languages: Python, JavaScript, TypeScript, Java, C, C++, Go, Rust, C#, Kotlin, PHP, Ruby, Swift.",
            "I can also provide different logic styles when requested: iterative, recursive, or optimized.",
            "",
            "Prompt format that works best:",
            "1) Problem statement",
            "2) Language",
            "3) Constraints and input/output format",
            "4) Ask for style: iterative / recursive / optimized",
        ]
    )


def generic_debug_response():
    return "\n".join(
        [
            "Paste the exact code, error message, and expected behavior.",
            "",
            "I will then return a direct fix instead of a generic explanation.",
        ]
    )


def generic_contest_response(problem_text, selected_languages, language_note=""):
    inference = infer_contest_technique(problem_text)
    code_sections = [f"```{language}\n{build_generic_contest_template(language)}\n```" for language in selected_languages]
    lines = [
        "1) Contest read",
        f"- Likely technique: {inference['label']}.",
        f"- Complexity target: {inference['complexity']}.",
    ]
    if language_note:
        lines.append(language_note)
    lines.extend(
        [
            "",
            "2) Plan",
            *[f"- {step}" for step in inference["steps"]],
            "",
            "3) Edge cases",
            "- Minimum-size input.",
            "- Repeated values, boundary indices, and empty structures when the statement allows them.",
            "- Large constraints that rule out quadratic solutions.",
            "",
            "4) Submission skeleton",
            *code_sections,
            "",
            "5) Next",
            "- Paste the exact statement, input/output format, and constraints, and I will turn this into a final accepted solution.",
        ]
    )
    return "\n".join(lines)


def extract_generic_task_topic(text):
    cleaned = normalize_space(strip_language_mentions(text))
    cleaned = re.sub(r"^(?:please\s+)?(?:give|show|write|create|build|generate|implement|send)(?:\s+me)?\s+", "", cleaned, flags=re.I)
    cleaned = re.sub(r"\b(?:full|complete|whole|runnable)\s+(?:code|program)\b", " ", cleaned, flags=re.I)
    cleaned = re.sub(r"\b(?:code|function|program|script|api)\s+for\b", " ", cleaned, flags=re.I)
    cleaned = re.sub(r"\b(?:code|function|program|script)\b", " ", cleaned, flags=re.I)
    cleaned = re.sub(r"\b(?:with|using)\s+(?:main|stdin|stdout|recursion|iteration|iterative|recursive|optimized)\b", " ", cleaned, flags=re.I)
    cleaned = re.sub(r"[^a-zA-Z0-9_+#.\\-\\s]", " ", cleaned)
    cleaned = normalize_space(cleaned).strip(" .:-")
    return cleaned or "custom task"


def generic_task_label(text):
    topic = extract_generic_task_topic(text)
    acronyms = {"api", "bfs", "dfs", "bst", "gcd", "lcm", "sql", "jwt", "oop"}
    words = [word.upper() if word.lower() in acronyms else word.capitalize() for word in topic.split()[:6]]
    return " ".join(words) or "Custom Coding Task"


def build_generic_topic_snippet(topic_text, language):
    safe_topic = extract_generic_task_topic(topic_text).replace('"', "'")
    lowered = safe_topic.lower()
    if re.search(r"\bstack\b", lowered):
        stack_snippets = {
            "python": "class Stack:\n    def __init__(self):\n        self.items = []\n\n    def push(self, value):\n        self.items.append(value)\n\n    def pop(self):\n        return self.items.pop() if self.items else None\n\n    def peek(self):\n        return self.items[-1] if self.items else None\n\nif __name__ == \"__main__\":\n    stack = Stack()\n    stack.push(10)\n    stack.push(20)\n    print(stack.peek())\n    print(stack.pop())",
            "java": "import java.util.*;\n\npublic class Main {\n  static class Stack {\n    private final ArrayList<Integer> items = new ArrayList<>();\n    void push(int value) { items.add(value); }\n    Integer pop() { return items.isEmpty() ? null : items.remove(items.size() - 1); }\n    Integer peek() { return items.isEmpty() ? null : items.get(items.size() - 1); }\n  }\n\n  public static void main(String[] args) {\n    Stack stack = new Stack();\n    stack.push(10);\n    stack.push(20);\n    System.out.println(stack.peek());\n    System.out.println(stack.pop());\n  }\n}",
            "javascript": "class Stack {\n  constructor() {\n    this.items = [];\n  }\n  push(value) {\n    this.items.push(value);\n  }\n  pop() {\n    return this.items.length ? this.items.pop() : null;\n  }\n  peek() {\n    return this.items.length ? this.items[this.items.length - 1] : null;\n  }\n}\n\nconst stack = new Stack();\nstack.push(10);\nstack.push(20);\nconsole.log(stack.peek());\nconsole.log(stack.pop());",
            "cpp": "#include <bits/stdc++.h>\nusing namespace std;\n\nclass Stack {\n public:\n  void push(int value) { items.push_back(value); }\n  int pop() {\n    if (items.empty()) return -1;\n    int value = items.back();\n    items.pop_back();\n    return value;\n  }\n  int peek() const { return items.empty() ? -1 : items.back(); }\n private:\n  vector<int> items;\n};\n\nint main() {\n  Stack stack;\n  stack.push(10);\n  stack.push(20);\n  cout << stack.peek() << '\\n';\n  cout << stack.pop() << '\\n';\n}",
        }
        snippet = stack_snippets.get(language)
        if snippet:
            return snippet
    if re.search(r"\bqueue\b", lowered):
        queue_snippets = {
            "python": "from collections import deque\n\nclass Queue:\n    def __init__(self):\n        self.items = deque()\n\n    def enqueue(self, value):\n        self.items.append(value)\n\n    def dequeue(self):\n        return self.items.popleft() if self.items else None\n\n    def front(self):\n        return self.items[0] if self.items else None\n\nif __name__ == \"__main__\":\n    queue = Queue()\n    queue.enqueue(10)\n    queue.enqueue(20)\n    print(queue.front())\n    print(queue.dequeue())",
            "java": "import java.util.*;\n\npublic class Main {\n  static class Queue {\n    private final ArrayDeque<Integer> items = new ArrayDeque<>();\n    void enqueue(int value) { items.offer(value); }\n    Integer dequeue() { return items.poll(); }\n    Integer front() { return items.peek(); }\n  }\n\n  public static void main(String[] args) {\n    Queue queue = new Queue();\n    queue.enqueue(10);\n    queue.enqueue(20);\n    System.out.println(queue.front());\n    System.out.println(queue.dequeue());\n  }\n}",
            "javascript": "class Queue {\n  constructor() {\n    this.items = [];\n  }\n  enqueue(value) {\n    this.items.push(value);\n  }\n  dequeue() {\n    return this.items.length ? this.items.shift() : null;\n  }\n  front() {\n    return this.items.length ? this.items[0] : null;\n  }\n}\n\nconst queue = new Queue();\nqueue.enqueue(10);\nqueue.enqueue(20);\nconsole.log(queue.front());\nconsole.log(queue.dequeue());",
            "cpp": "#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n  queue<int> q;\n  q.push(10);\n  q.push(20);\n  cout << q.front() << '\\n';\n  q.pop();\n  cout << q.front() << '\\n';\n}",
        }
        snippet = queue_snippets.get(language)
        if snippet:
            return snippet
    if "linked list" in lowered:
        linked_list_snippets = {
            "python": "class Node:\n    def __init__(self, value):\n        self.value = value\n        self.next = None\n\nclass LinkedList:\n    def __init__(self):\n        self.head = None\n\n    def append(self, value):\n        node = Node(value)\n        if self.head is None:\n            self.head = node\n            return\n        current = self.head\n        while current.next is not None:\n            current = current.next\n        current.next = node\n\n    def to_list(self):\n        values = []\n        current = self.head\n        while current is not None:\n            values.append(current.value)\n            current = current.next\n        return values\n\nif __name__ == \"__main__\":\n    linked_list = LinkedList()\n    linked_list.append(10)\n    linked_list.append(20)\n    print(linked_list.to_list())",
            "java": "public class Main {\n  static class Node {\n    int value;\n    Node next;\n    Node(int value) { this.value = value; }\n  }\n\n  static class LinkedList {\n    Node head;\n\n    void append(int value) {\n      Node node = new Node(value);\n      if (head == null) {\n        head = node;\n        return;\n      }\n      Node current = head;\n      while (current.next != null) current = current.next;\n      current.next = node;\n    }\n\n    void printList() {\n      Node current = head;\n      while (current != null) {\n        System.out.print(current.value + (current.next != null ? \" -> \" : \"\\n\"));\n        current = current.next;\n      }\n    }\n  }\n\n  public static void main(String[] args) {\n    LinkedList list = new LinkedList();\n    list.append(10);\n    list.append(20);\n    list.printList();\n  }\n}",
        }
        snippet = linked_list_snippets.get(language)
        if snippet:
            return snippet
    if re.search(r"\bbfs\b|\bbreadth first\b", lowered):
        bfs_snippets = {
            "python": "from collections import deque\n\ndef bfs(graph, start):\n    order = []\n    queue = deque([start])\n    visited = {start}\n    while queue:\n        node = queue.popleft()\n        order.append(node)\n        for neighbor in graph.get(node, []):\n            if neighbor not in visited:\n                visited.add(neighbor)\n                queue.append(neighbor)\n    return order\n\nif __name__ == \"__main__\":\n    graph = {'A': ['B', 'C'], 'B': ['D'], 'C': ['E'], 'D': [], 'E': []}\n    print(bfs(graph, 'A'))",
            "java": "import java.util.*;\n\npublic class Main {\n  static List<String> bfs(Map<String, List<String>> graph, String start) {\n    List<String> order = new ArrayList<>();\n    Queue<String> queue = new ArrayDeque<>();\n    Set<String> visited = new HashSet<>();\n    queue.offer(start);\n    visited.add(start);\n    while (!queue.isEmpty()) {\n      String node = queue.poll();\n      order.add(node);\n      for (String next : graph.getOrDefault(node, Collections.emptyList())) {\n        if (visited.add(next)) queue.offer(next);\n      }\n    }\n    return order;\n  }\n\n  public static void main(String[] args) {\n    Map<String, List<String>> graph = new HashMap<>();\n    graph.put(\"A\", Arrays.asList(\"B\", \"C\"));\n    graph.put(\"B\", Arrays.asList(\"D\"));\n    graph.put(\"C\", Arrays.asList(\"E\"));\n    graph.put(\"D\", Collections.emptyList());\n    graph.put(\"E\", Collections.emptyList());\n    System.out.println(bfs(graph, \"A\"));\n  }\n}",
        }
        snippet = bfs_snippets.get(language)
        if snippet:
            return snippet
    if re.search(r"\bdfs\b|\bdepth first\b", lowered):
        dfs_snippets = {
            "python": "def dfs(graph, start, visited=None, order=None):\n    if visited is None:\n        visited = set()\n    if order is None:\n        order = []\n    visited.add(start)\n    order.append(start)\n    for neighbor in graph.get(start, []):\n        if neighbor not in visited:\n            dfs(graph, neighbor, visited, order)\n    return order\n\nif __name__ == \"__main__\":\n    graph = {'A': ['B', 'C'], 'B': ['D'], 'C': ['E'], 'D': [], 'E': []}\n    print(dfs(graph, 'A'))",
            "java": "import java.util.*;\n\npublic class Main {\n  static void dfs(Map<String, List<String>> graph, String node, Set<String> visited, List<String> order) {\n    visited.add(node);\n    order.add(node);\n    for (String next : graph.getOrDefault(node, Collections.emptyList())) {\n      if (!visited.contains(next)) dfs(graph, next, visited, order);\n    }\n  }\n\n  public static void main(String[] args) {\n    Map<String, List<String>> graph = new HashMap<>();\n    graph.put(\"A\", Arrays.asList(\"B\", \"C\"));\n    graph.put(\"B\", Arrays.asList(\"D\"));\n    graph.put(\"C\", Arrays.asList(\"E\"));\n    graph.put(\"D\", Collections.emptyList());\n    graph.put(\"E\", Collections.emptyList());\n    List<String> order = new ArrayList<>();\n    dfs(graph, \"A\", new HashSet<>(), order);\n    System.out.println(order);\n  }\n}",
        }
        snippet = dfs_snippets.get(language)
        if snippet:
            return snippet
    if re.search(r"\bdijkstra\b|\bshortest path\b", lowered):
        dijkstra_snippets = {
            "python": "import heapq\n\ndef dijkstra(graph, start):\n    distances = {node: float('inf') for node in graph}\n    distances[start] = 0\n    heap = [(0, start)]\n    while heap:\n        current_distance, node = heapq.heappop(heap)\n        if current_distance > distances[node]:\n            continue\n        for neighbor, weight in graph[node]:\n            new_distance = current_distance + weight\n            if new_distance < distances.get(neighbor, float('inf')):\n                distances[neighbor] = new_distance\n                heapq.heappush(heap, (new_distance, neighbor))\n    return distances\n\nif __name__ == \"__main__\":\n    graph = {'A': [('B', 4), ('C', 1)], 'B': [('D', 1)], 'C': [('B', 2), ('D', 5)], 'D': []}\n    print(dijkstra(graph, 'A'))",
            "java": "import java.util.*;\n\npublic class Main {\n  static class Edge {\n    String to;\n    int weight;\n    Edge(String to, int weight) { this.to = to; this.weight = weight; }\n  }\n\n  static Map<String, Integer> dijkstra(Map<String, List<Edge>> graph, String start) {\n    Map<String, Integer> distance = new HashMap<>();\n    for (String node : graph.keySet()) distance.put(node, Integer.MAX_VALUE);\n    distance.put(start, 0);\n    PriorityQueue<String> pq = new PriorityQueue<>(Comparator.comparingInt(distance::get));\n    pq.offer(start);\n    while (!pq.isEmpty()) {\n      String node = pq.poll();\n      for (Edge edge : graph.getOrDefault(node, Collections.emptyList())) {\n        int nextDistance = distance.get(node) + edge.weight;\n        if (nextDistance < distance.getOrDefault(edge.to, Integer.MAX_VALUE)) {\n          distance.put(edge.to, nextDistance);\n          pq.offer(edge.to);\n        }\n      }\n    }\n    return distance;\n  }\n\n  public static void main(String[] args) {\n    Map<String, List<Edge>> graph = new HashMap<>();\n    graph.put(\"A\", Arrays.asList(new Edge(\"B\", 4), new Edge(\"C\", 1)));\n    graph.put(\"B\", Arrays.asList(new Edge(\"D\", 1)));\n    graph.put(\"C\", Arrays.asList(new Edge(\"B\", 2), new Edge(\"D\", 5)));\n    graph.put(\"D\", Collections.emptyList());\n    System.out.println(dijkstra(graph, \"A\"));\n  }\n}",
        }
        snippet = dijkstra_snippets.get(language)
        if snippet:
            return snippet
    templates = {
        "python": f"def solve():\n    # Implement: {safe_topic}\n    return \"done\"",
        "javascript": f"function solve() {{\n  // Implement: {safe_topic}\n  return \"done\";\n}}",
        "typescript": f"function solve(): string {{\n  // Implement: {safe_topic}\n  return \"done\";\n}}",
        "java": f"public static String solve() {{\n  // Implement: {safe_topic}\n  return \"done\";\n}}",
        "c": f"int solve(void) {{\n  /* Implement: {safe_topic} */\n  return 0;\n}}",
        "cpp": f"string solve() {{\n  // Implement: {safe_topic}\n  return \"done\";\n}}",
        "go": f"func Solve() string {{\n  // Implement: {safe_topic}\n  return \"done\"\n}}",
        "rust": f"fn solve() -> &'static str {{\n    // Implement: {safe_topic}\n    \"done\"\n}}",
        "c#": f"public static string Solve()\n{{\n    // Implement: {safe_topic}\n    return \"done\";\n}}",
        "kotlin": f"fun solve(): String {{\n    // Implement: {safe_topic}\n    return \"done\"\n}}",
        "php": f"function solve(): string {{\n    // Implement: {safe_topic}\n    return \"done\";\n}}",
        "ruby": f"def solve\n  # Implement: {safe_topic}\n  \"done\"\nend",
        "swift": f"func solve() -> String {{\n    // Implement: {safe_topic}\n    return \"done\"\n}}",
    }
    return templates.get(language, templates["python"])


def find_task_anchor_user_text(user_turns):
    for turn in reversed(user_turns[:-1]):
        if not turn:
            continue
        if is_shallow_code_followup(turn):
            continue
        if detect_coding_task(turn)["id"] != "generic" or looks_like_contest_problem(turn) or KNOWN_CODE_TASK_PATTERN.search(turn):
            return turn
    return user_turns[-2] if len(user_turns) >= 2 else ""


def coding_response_for_messages(messages, prefer_full_code=False):
    user_turns = [normalize_space(message.get("content")) for message in (messages or []) if message.get("role") == "user" and normalize_space(message.get("content"))]
    if not user_turns:
        return ""

    latest_text = user_turns[-1]
    previous_text = user_turns[-2] if len(user_turns) >= 2 else ""
    task_anchor_text = find_task_anchor_user_text(user_turns)

    latest_language_only = bool(LANGUAGE_ONLY_PATTERN.fullmatch(latest_text))
    latest_code_only = is_shallow_code_followup(latest_text) and not latest_language_only
    language_source = latest_text if latest_language_only else f"{task_anchor_text} {previous_text} {latest_text}".strip()

    task_source = latest_text
    if latest_language_only:
        task_source = strip_language_mentions(task_anchor_text or previous_text or latest_text)
    elif latest_code_only:
        task_source = task_anchor_text or previous_text or latest_text

    code_text = normalize_space(task_source or latest_text)
    task = detect_coding_task(code_text)
    contest_prompt = looks_like_contest_problem(code_text)
    code_request = (
        contest_prompt
        or task["id"] != "generic"
        or bool(CODE_REQUEST_PATTERN.search(code_text))
        or bool(re.search(r"\b(code|function|program|script|api)\b", code_text, re.I) and KNOWN_CODE_TASK_PATTERN.search(code_text))
        or latest_code_only
        or latest_language_only
    )

    if not code_request:
        if CODING_CAPABILITY_PATTERN.search(latest_text) or (re.search(r"\bcoding\b", latest_text, re.I) and count_words(latest_text) <= 7):
            return coding_support_response()
        return ""

    if task["id"] == "generic" and GENERIC_DEBUG_PATTERN.search(code_text):
        return generic_debug_response()

    languages = detect_requested_languages(language_source)
    supported = supported_languages_for_task(task["id"])
    language_note = ""
    if supported:
        kept = [language for language in languages if language in supported]
        if not kept and any(language in TEMPLATE_DEFERRED_LANGUAGES for language in languages):
            return ""
        languages = kept or [supported[0]]
        if kept != languages:
            language_note = f"- Advanced template for {task['label']} is currently available in {', '.join(supported)}."

    style = detect_coding_style(
        f"{code_text} {latest_text}",
        prefer_full_code=prefer_full_code or latest_language_only or latest_code_only or task["id"] != "generic" or bool(CODE_REQUEST_PATTERN.search(code_text)),
    )
    style["topic_text"] = code_text

    if task["id"] == "generic" and contest_prompt:
        return generic_contest_response(code_text, languages[: min(len(languages), 3)], language_note=language_note)

    selected_languages = languages[: min(len(languages), 3)]
    code_sections = []
    for language in selected_languages:
        snippet = build_task_snippet(task["id"], language, style)
        if not normalize_space(snippet):
            snippet = apply_full_program_wrapper("generic", language, build_generic_topic_snippet(code_text, language), True)
        if not normalize_space(snippet):
            return ""
        code_sections.append(f"```{language}\n{snippet}\n```")
        if style["wants_different"] and len(selected_languages) == 1:
            alternative = build_alternative_snippet(task["id"], language, style)
            if alternative and alternative != snippet:
                code_sections.append(f"Alternative logic:\n```{language}\n{alternative}\n```")

    task_label = task["label"] if task["id"] != "generic" else generic_task_label(code_text)
    lines = [
        "1) Task",
        f"- Task: {task_label}.",
        f"- Language{'s' if len(selected_languages) > 1 else ''}: {', '.join(selected_languages)}.",
    ]
    if language_note:
        lines.append(language_note)
    lines.extend(
        [
            "",
            "2) Key idea",
            *[f"- {item}" for item in task["logic"]],
            "- Included alternative logic when applicable." if style["wants_different"] else "",
            "",
            "3) Complexity",
            f"- {task['complexity']}",
            "",
            "4) Edge cases",
            *[f"- {item}" for item in edge_cases_for_task(task["id"])],
            "",
            "5) Full runnable code",
            *code_sections,
            "",
            "6) Notes",
            "- This version includes a runnable entry point with a sample invocation.",
            "- If you want stdin/stdout style, class-based structure, or test cases, I can switch the format directly.",
        ]
    )
    return "\n".join(item for item in lines if item != "")
