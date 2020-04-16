.PHONY: build

build:
	cd src && \
	npm install && \
	./node_modules/.bin/grunt
	git diff-index --quiet HEAD -- || { \
		echo "ERROR: Dirty repository found"; \
		git status --porcelain; \
		exit 1; }
