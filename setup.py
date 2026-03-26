from pathlib import Path

from setuptools import find_packages, setup


def load_requirements() -> list[str]:
    requirements_path = Path(__file__).with_name("requirements.txt")
    requirements: list[str] = []

    for raw_line in requirements_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.split("#", 1)[0].strip()
        if not line:
            continue
        requirements.append(line)

    return requirements

setup(
    name="garud_drishti",
    version="0.1",
    packages=find_packages(),
    install_requires=load_requirements(),
)
