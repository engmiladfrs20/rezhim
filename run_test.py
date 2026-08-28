import subprocess

result = subprocess.run(['pnpm', '--filter', '@nutriai/worker-api', 'test'], capture_output=True, text=True, shell=True)
print(result.stdout)
print(result.stderr)
