all: run

PYTHON3 := $(shell command -v python3.7 || command -v python3)

venv: Makefile requirements-dev.txt
	rm -rf venv
	virtualenv venv --python=$(PYTHON3)
	venv/bin/pip install -r requirements-dev.txt
	venv/bin/pre-commit install -f --install-hooks

node_modules: package.json
	yarn

build: node_modules src/index.js
	yarn build
