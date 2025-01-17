#!/usr/bin/env python
"""Integration test number 0 for the query analyzer"""

'''
Welcome to Query Advisor! 

To conduct this test with the original query described below, simply run this python file after you completed all necessary installations.
View the analyzer documentation for further questions and guidance. 

Thank you for partitioning in this test program!
'''

from search_query.query import Query
from search_query.and_query import AndQuery
from search_query.or_query import OrQuery
from search_query.not_query import NotQuery
from search_query.constants import Fields

from search_query.query_analyzer.query_analyzer import QueryAnalyzer

# pylint: disable=line-too-long
# flake8: noqa: E501

'''
Original query: 
    (instrument[tiab] OR instruments[tiab] OR Measurement[tiab] OR Measurements[tiab] OR Measures[tiab] OR Measure[tiab] OR scale[tiab] OR scales[tiab] OR validate[tiab] OR validation[tiab] OR validates[tiab] OR validated[tiab] OR validity[tiab])
AND 
        ((bisexual[tiab] OR "transgender"[tiab]) 
    AND 
        ("humans"[tiab] NOT "animals"[tiab]))
'''

# Define the terms
terms1 = [
    Query('instrument', search_field=Fields.ABSTRACT),
    Query('instruments', search_field=Fields.ABSTRACT),
    Query('Measurement', search_field=Fields.ABSTRACT),
    Query('Measurements', search_field=Fields.ABSTRACT),
    Query('Measures', search_field=Fields.ABSTRACT),
    Query('Measure', search_field=Fields.ABSTRACT),
    Query('scale', search_field=Fields.ABSTRACT),
    Query('scales', search_field=Fields.ABSTRACT),
    Query('validate', search_field=Fields.ABSTRACT),
    Query('validation', search_field=Fields.ABSTRACT),
    Query('validates', search_field=Fields.ABSTRACT),
    Query('validated', search_field=Fields.ABSTRACT),
    Query('validity', search_field=Fields.ABSTRACT)
]

terms2 = [
    Query('bisexual', search_field=Fields.ABSTRACT),
    Query('"transgender"', search_field=Fields.ABSTRACT)
]

terms3 = [
    Query('"humans"', search_field=Fields.ABSTRACT),
    Query('"animals"', search_field=Fields.ABSTRACT)
]

# Build the query
query = AndQuery(
    [OrQuery(terms1, search_field=Fields.ABSTRACT),
    AndQuery(
        [OrQuery(terms2, search_field=Fields.ABSTRACT), NotQuery(terms3, search_field=Fields.ABSTRACT)],
        search_field=Fields.ABSTRACT
    )],
    search_field=Fields.ABSTRACT
)

if __name__ == "__main__":
    analyzer = QueryAnalyzer()
    analyzer.analyze_yield(query, "colrev.pubmed")