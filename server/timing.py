"""Scenario timing constants.

Wall-clock is the only clock. `simulation_time` tracks wall-seconds since
`/play`, 1:1. `speed_factor` is a load-time scalar on authored event times —
nothing else.

At `/init`, every authored event time is divided by `speed_factor`, along
with `condition_at` and `event_timeline_end`. After that the simulation
runs in plain wall-time.

Speed-factor convention:
- `speed_factor > 1.0` → faster: event authored at sim=300 fires at wall=300/sf.
- `speed_factor = 1.0` → identity.
- `speed_factor < 1.0` → slower.
- `MAX_SPEED_FACTOR = 4.0` is the fastest allowed. Above that the
  post-condition buffer would compress below the reaction window.

Kill-at formula:
    kill_at_wall = MAX_CONDITION_AT / speed_factor + REACTION_WINDOW

The `+ REACTION_WINDOW` is 30 wall-seconds, constant across every
speed_factor, so the agent's think-budget past target is the same
regardless of speed. Examples:
- speed_factor=1.0  → kill_at_wall =  630s (10.5 min)
- speed_factor=2.0  → kill_at_wall =  330s (5.5 min)
- speed_factor=4.0  → kill_at_wall =  180s (3 min)
- speed_factor=0.5  → kill_at_wall = 1230s (20.5 min)

Authored event timelines extend past `MAX_CONDITION_AT` by `EVENT_BUFFER`
so the reaction window is still populated after divide-by-MAX. At
`MAX_SPEED_FACTOR=4.0`, the authored buffer (120 sim-sec) compresses to
exactly the 30 wall-sec reaction window.

Rationales:
- `MIN_CONDITION_AT = 10` gives the agent a few seconds of boot/poll-setup
  time before anything interesting can happen.
- `MAX_SPEED_FACTOR = 4.0` is the design ceiling. Any faster and the 120s
  authored buffer would drain before the reaction window ends.
"""

MIN_CONDITION_AT: float = 10.0
MAX_CONDITION_AT: float = 600.0
REACTION_WINDOW: float = 30.0
MAX_SPEED_FACTOR: float = 4.0

EVENT_BUFFER: float = REACTION_WINDOW * MAX_SPEED_FACTOR
EVENT_TIMELINE_END: float = MAX_CONDITION_AT + EVENT_BUFFER
KILL_AT: float = MAX_CONDITION_AT + REACTION_WINDOW

SCENARIO_SEED: int = 42


def validate_speed_factor(x: float) -> float:
    """Raise if non-positive or above MAX_SPEED_FACTOR. Return x unchanged."""
    if not (x > 0):
        raise ValueError(f"speed_factor must be positive, got {x!r}")
    if x > MAX_SPEED_FACTOR:
        raise ValueError(
            f"speed_factor {x} above MAX_SPEED_FACTOR {MAX_SPEED_FACTOR}"
        )
    return x


def kill_at_wall(speed_factor: float) -> float:
    """Wall-clock kill time for a run at the given speed_factor.

    Formula: MAX_CONDITION_AT / speed_factor + REACTION_WINDOW.
    The reaction window stays constant in wall-clock across all speeds.
    """
    return MAX_CONDITION_AT / speed_factor + REACTION_WINDOW
