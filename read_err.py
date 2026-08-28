import re
text = open('py_output.txt', encoding='utf-8').read()
match = re.search(r'FAIL.*?when system metadata is missing.*?(AssertionError.*?)\n\n', text, re.DOTALL)
if match:
    print(match.group(1))
else:
    print(text[-2000:])
