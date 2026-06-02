"""
BeZhas Aegis — Pytest configuration for dept_agents tests.
"""

import asyncio
import pytest


# ------------------------------------------------------------------ #
#  Async test support                                                 #
# ------------------------------------------------------------------ #

@pytest.fixture(scope="session")
def event_loop():
    """Use a single event loop for all async tests in a session."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(autouse=True)
def reset_metrics_singleton():
    """Reset the DeptAgentMetrics singleton between tests."""
    from dept_agents.core.metrics import DeptAgentMetrics
    DeptAgentMetrics._instance = None
    yield
    DeptAgentMetrics._instance = None
