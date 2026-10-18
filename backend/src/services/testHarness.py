import sys
import json
import time
import inspect
import traceback

def main():
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw)
    except Exception as e:
        print(json.dumps({"status": "runner_error", "error": f"Failed to parse payload: {str(e)}", "results": []}))
        return

    candidate_code = payload.get("code", "")
    mode = payload.get("mode", "base")
    tests = payload.get("tests", [])

    candidate_globals = {
        "__name__": "candidate_solution",
        "__doc__": None,
        "__package__": None
    }

    # 1. Syntax analysis
    try:
        compiled = compile(candidate_code, "<candidate_code>", "exec")
    except SyntaxError as se:
        tb = "".join(traceback.format_exception_only(type(se), se)).strip()
        print(json.dumps({
            "status": "syntax_error",
            "error": tb,
            "line": se.lineno,
            "offset": se.offset,
            "results": []
        }))
        return

    # 2. Execution / Definition
    try:
        exec(compiled, candidate_globals)
    except Exception as re:
        tb = "".join(traceback.format_exception(type(re), re, re.__traceback__)).strip()
        print(json.dumps({
            "status": "runtime_error",
            "error": tb,
            "results": []
        }))
        return

    if "find_duplicates" not in candidate_globals:
        print(json.dumps({
            "status": "runtime_error",
            "error": "Function 'find_duplicates' is not defined in submitted code. Please define 'def find_duplicates(nums):'.",
            "results": []
        }))
        return

    fn = candidate_globals["find_duplicates"]
    if not callable(fn):
        print(json.dumps({
            "status": "runtime_error",
            "error": "'find_duplicates' is not a callable function.",
            "results": []
        }))
        return

    sig = inspect.signature(fn)
    is_follow_up = (mode == "follow-up")

    # 3. Test execution
    results = []
    for t in tests:
        test_id = t["id"]
        test_name = t["name"]
        inp = t["input"]
        expected = t["expected"]
        min_count = t.get("minCount", 2)

        start_time = time.perf_counter()
        status = "passed"
        actual = None
        assertion = None

        try:
            if is_follow_up and len(sig.parameters) >= 2:
                actual = fn(list(inp), min_count)
            else:
                actual = fn(list(inp))

            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)

            if isinstance(actual, (list, tuple)) and list(actual) == expected:
                status = "passed"
            else:
                status = "failed"
                if not isinstance(actual, (list, tuple)):
                    assertion = f"Expected list but got {type(actual).__name__}: {repr(actual)}"
                else:
                    assertion = f"Returned {repr(list(actual))} instead of expected {repr(expected)}."
        except Exception as e:
            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
            status = "error"
            actual = f"Exception: {type(e).__name__}"
            assertion = f"{type(e).__name__}: {str(e)}"

        results.append({
            "id": test_id,
            "name": test_name,
            "input": repr(inp),
            "expected": repr(expected),
            "actual": repr(actual) if actual is not None else "None",
            "status": status,
            "passed": (status == "passed"),
            "duration": f"{elapsed_ms}ms",
            "assertion": assertion
        })

    print(json.dumps({
        "status": "completed",
        "results": results
    }))

if __name__ == "__main__":
    main()
