# Query Analyzer

Query Analyzer is an optional extension of the search-query package. It allows the user to analyze the yield of the search query they built with search-query. Momentarily, it depends on the CoLRev environment to perform requests in Crossref or PubMed for demo purposes. Other search sources or environments may be implemented in the future. 

The program can be used programmatically after building a query with search-query. 


## Installation

Query Analyzer is installed automatically during the installation of search-query. To successfully use the demo of Query Analyzer, CoLRev needs to be installed.

To install search-query, run:

```
pip install search-query
```

To install CoLRev, run:

```
pip install colrev
```


## Programmatic use

To run Query Analyzer, create a python file and import Query Analyzer and all necessary query types. Secondly, code in your query with search-query and call the analyzer with your query as a parameter. Finally, execute the file through your IDE. The following example file shows the basic steps in python code:

```Python
# Import Query types and Query Analyzer
from search_query import OrQuery, AndQuery
from search_query.query_analyzer.query_analyzer import QueryAnalyzer

# Build your query programmatically with search-query
digital_synonyms = OrQuery(["digital", "virtual", "online"], search_field="Abstract")
work_synonyms = OrQuery(["work", "labor", "service"], search_field="Abstract")
query = AndQuery([digital_synonyms, work_synonyms], search_field="Author Keywords")

# Now, call Query Analyzer:
analyzer = QueryAnalyzer()
analyzer.analyze_yield(query=query, platform="colrev.crossref")
```

Parameters for Query Analyzer:

- query: the query object built within the file
- platform: the search source where you want to perform the query (for now, only crossref and PubMed are accessible)

### CoLRev

If you decide to search with Crossref, Query Analyzer will use its yield estimation as Crossref does not support nested queries in its API. Yields for complex queries will be estimated with the help of DOI samples.
Searching with PubMed will directly request the total yield of the given (sub-)query. 

**Please remember to always add "colrev" to the platform argument. Otherwise, the search will not work.**

To use the API of [Crossref](https://github.com/CoLRev-Environment/colrev/blob/main/colrev/packages/crossref/src/crossref_api.py): platform="colrev.crossref"

To use the API of [PubMed](https://github.com/CoLRev-Environment/colrev/blob/main/colrev/packages/pubmed/src/pubmed_api.py): platform="colrev.pubmed"

### other Environments

Provide documentation for your implemented environment here.


## UI

The results of the analysis of your query will be displayed in a simple Graphic User Interface (GUI). The upper partition of the GUI window displays your full query at the top left and the corresponding yield on the top right. The lines below indicate the respective yields of every subquery of your query. This visualization allows to identify problematic terms - those, whose yield is either extremely high or too low. 

Currently, the optimal yield range is set from 200 to 2000 results. This is based on the PRISMA statement for systematic literature reviews. To change the yield range, you can edit <analyzer_constants.py>.

The lower partition of the GUI displays the program's analysis of the yields, shows the identified problematic area and gives a recommendation on how to refine that specific area of the query. 

To refine the query according to the analysis, simply close the GUI window and edit the query in the python file.


## For Contributors

All contributors are highly encouraged to extend, use and improve this program. It is built to be connected to any CoLRev API or environment with very limited effort. Please check if the APIs you are implementing support nested boolean queries (e.g. "Luke" AND "Skywalker" AND ("Han" OR "Solo")). If that is not the case, Query Analyzer provides an estimation tool that estimates yields from query samples. Please make sure to use the correct method in the <yield_collector.py> module.

### New search environment

To connect a new search environment, follow these steps:
1. Add a new module and class for your environment, ideally naming it <nameOfYourEnvironment_collector.py>.
2. Implement API access and other connections to your program in that module.
3. Import your module in <yield_collector.py> and extend the if-clause in the collect method to your liking.
4. Head back to this documentation and provide the users with information on how to access your environment through the platform argument.

### New CoLRev API

If you want to connect a new API that is implemented in CoLRev, follow these steps:
1. Go to the <colrev_collector.py> module and import your API.
2. Implement your API in a new method and extend the if-clause in the collect method.
3. Head back to this documentation, add the GitHub link to your API and provide users with the correct platform argument.


## How to cite

Query Analyzer was developed as part of the following Bachelor's thesis:

- Theis, R. (2024). Analyzing the yield of literature search queries: An open-source design science approach. Otto-Friedrich-University of Bamberg.


## Not what you are looking for?

If Query Analyzer is not the right tool for your analysis, it might be worth it to look at these related programs:

[litsearchr](https://github.com/elizagrames/litsearchr.git) -> an R package for query refinement (Grames et al., 2019)

[searchrefiner](https://github.com/ielab/searchrefiner.git) -> a tool for query visualization and analysis (Scells & Zuccon, 2018)
