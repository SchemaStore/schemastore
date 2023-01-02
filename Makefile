.PHONY: build remote maintenance coverage
.SILENT: build remote maintenance coverage

build: # Run the local build process
	cd src && \
	npm ci && \
	npm run build
	git diff-index --quiet HEAD -- || { \
		echo "ERROR: Dirty repository found"; \
		git status --porcelain; \
		exit 1; }

remote: # Run the remote build process
	cd src && \
	npm ci && \
	npm run remote

maintenance: # Run the maintenance check
	cd src && \
	npm ci && \
	npm run maintenance

# For a specific schema, generate a coverage report in src/temp/coverage/report/index.html
# Example: via 'make' to generate coverage report for schema-catalog.json
# make coverage schema=schema-catalog.json
coverage: # generate HTML coverage report
	cd src && \
	npm ci && \
	npx c8 --temp-directory temp/coverage -x 'Gruntfile.cjs' grunt local_coverage --SchemaName=$(schema) && \
	npx c8 --temp-directory temp/coverage report -r html -o temp/coverage/report -x 'Gruntfile.cjs' && \
	echo "Full HTML report files stored in 'src/temp/coverage/report/index.html'"
