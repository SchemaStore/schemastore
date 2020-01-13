.PHONY: build

build:
	cd src && \
	npm install && \
	./node_modules/.bin/grunt
