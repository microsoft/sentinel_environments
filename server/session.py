# mutable state for a single simulation run.
# server.py creates one Session on /init and mutates it on /advance and api actions.
# handlers read and write session fields to track what the user has done
# (e.g. liked a post, bought a stock, read an email).
#
# each environment has two kinds of session data:
#   - lists (e.g. micromail_emails): the items visible to the user, populated from catalogs
#   - state dicts (e.g. micromail_email_states): per-item mutable flags like {isRead, isFlagged}
#
# flow: /init -> server.py builds Session from catalogs -> handlers mutate session on user actions
# example: micromail handler marks email as read -> session.micromail_email_states[id]["isRead"] = True
#
# catalogs.py holds immutable data; this file holds everything that can change.

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class Session:
    status: str  # preinit | ready | running_auto | running_manual | completed
    simulation_time: float
    start_wall_time: Optional[float]
    events: list[dict]
    next_event_index: int

    environment: str
    event_timeline_end: float
    baseline_metrics: dict
    eval_sql: str = ""
    condition_at: Optional[float] = None
    speed_factor: float = 1.0
    contact_get_time: Optional[int] = None
    contact_post_time: Optional[int] = None
    contact_message: Optional[str] = None

    # MicroMail
    micromail_emails: list[dict] = field(default_factory=list)
    micromail_email_states: dict[str, dict] = field(default_factory=dict)

    # MicroChat
    microchat_messages: list[dict] = field(default_factory=list)
    microchat_message_states: dict[str, dict] = field(default_factory=dict)
    microchat_conversations: list[dict] = field(default_factory=list)
    microchat_conversation_states: dict[str, dict] = field(default_factory=dict)
    microchat_teams: list[dict] = field(default_factory=list)
    microchat_calls: list[dict] = field(default_factory=list)

    # MicroDin
    microdin_posts: list[dict] = field(default_factory=list)
    microdin_post_states: dict[str, dict] = field(default_factory=dict)
    microdin_connections: list[dict] = field(default_factory=list)
    microdin_connection_states: dict[str, dict] = field(default_factory=dict)
    microdin_conversations: list[dict] = field(default_factory=list)
    microdin_messages: list[dict] = field(default_factory=list)
    microdin_message_states: dict[str, dict] = field(default_factory=dict)
    microdin_notifications: list[dict] = field(default_factory=list)
    microdin_notification_states: dict[str, dict] = field(default_factory=dict)
    microdin_jobs: list[dict] = field(default_factory=list)
    microdin_job_states: dict[str, dict] = field(default_factory=dict)
    microdin_profile_view_count: int = 52
    microdin_page_visitor_count: int = 276
    microdin_connections_count: int = 0
    microdin_initial_connection_ids: list[str] = field(default_factory=list)
    microdin_profile_sections: list[dict] = field(default_factory=list)

    # MicroFy
    microfy_tracks: list[dict] = field(default_factory=list)
    microfy_track_states: dict[str, dict] = field(default_factory=dict)  # {isLiked, playCount}
    microfy_playlists: list[dict] = field(default_factory=list)
    microfy_user_created_playlists: list[dict] = field(default_factory=list)  # user-created playlists
    microfy_followed_artists: set[str] = field(default_factory=set)
    microfy_moods: list[dict] = field(default_factory=list)

    # MicroGram
    microgram_posts: list[dict] = field(default_factory=list)
    microgram_post_states: dict[str, dict] = field(default_factory=dict)  # {isLiked, isSaved}
    microgram_stories: list[dict] = field(default_factory=list)
    microgram_story_states: dict[str, dict] = field(default_factory=dict)  # {isViewed}
    microgram_messages: list[dict] = field(default_factory=list)  # DM conversations
    microgram_message_states: dict[str, dict] = field(default_factory=dict)  # id → {isRead}
    microgram_activity: list[dict] = field(default_factory=list)
    microgram_followed_users: set[str] = field(default_factory=set)
    microgram_user_created_comments: list[dict] = field(default_factory=list)  # user-posted comments

    # MicroHood
    microhood_stocks: list[dict] = field(default_factory=list)        # stock catalog rows
    microhood_stock_states: dict[str, dict] = field(default_factory=dict)  # symbol → {shares, avgCost}
    microhood_watchlist: list[dict] = field(default_factory=list)
    microhood_watchlist_states: dict[str, dict] = field(default_factory=dict)  # symbol → {inWatchlist}
    microhood_news: list[dict] = field(default_factory=list)
    microhood_buying_power: float = 10000.0
    microhood_orders: list[dict] = field(default_factory=list)
    microhood_price_waypoints: dict[str, list[list[float]]] = field(default_factory=dict)  # symbol → [[time, price], ...] sorted by time
    microhood_starting_prices: dict[str, float] = field(default_factory=dict)  # symbol → price at t=0 (from catalog)

    # MicroHub
    microhub_repository: dict = field(default_factory=dict)
    microhub_files: list[dict] = field(default_factory=list)
    microhub_issues: list[dict] = field(default_factory=list)
    microhub_issue_states: dict[str, dict] = field(default_factory=dict)   # id → {state}
    microhub_prs: list[dict] = field(default_factory=list)
    microhub_pr_states: dict[str, dict] = field(default_factory=dict)      # id → {state}
    microhub_commits: list[dict] = field(default_factory=list)
    microhub_runs: list[dict] = field(default_factory=list)
    microhub_workflows: list[dict] = field(default_factory=list)
    microhub_wiki: list[dict] = field(default_factory=list)
    microhub_projects: list[dict] = field(default_factory=list)
    microhub_activity: list[dict] = field(default_factory=list)
    microhub_insights: list[dict] = field(default_factory=list)
    microhub_releases: list[dict] = field(default_factory=list)
    microhub_labels: list[dict] = field(default_factory=list)
    microhub_security: list[dict] = field(default_factory=list)
    microhub_code_scanning: list[dict] = field(default_factory=list)
    microhub_settings: dict = field(default_factory=dict)
    microhub_deployments: list[dict] = field(default_factory=list)
    microhub_packages: list[dict] = field(default_factory=list)
    microhub_starred: bool = False
    microhub_watched: bool = False
    microhub_forked: bool = False
    microhub_star_count: int = 0
    microhub_fork_count: int = 0
    microhub_watch_count: int = 0
    microhub_user_created_comments: list[dict] = field(default_factory=list)  # user-added comments on issues/PRs
    microhub_merged_prs: set[str] = field(default_factory=set)             # PR IDs merged by user
    microhub_following_users: set[str] = field(default_factory=set)        # usernames followed by user
    microhub_user_created_issues: list[dict] = field(default_factory=list)
    microhub_user_created_prs: list[dict] = field(default_factory=list)
    microhub_user_created_repos: list[dict] = field(default_factory=list)
    microhub_star_waypoints: list[list[float]] = field(default_factory=list)  # [[time, stars], ...]
    microhub_star_offset: int = 0                                             # user star bump, added on top of interpolated value

    # MicroScholar
    microscholar_papers: list[dict] = field(default_factory=list)
    microscholar_paper_states: dict[str, dict] = field(default_factory=dict)
    microscholar_alerts: list[dict] = field(default_factory=list)
    microscholar_alert_states: dict[str, dict] = field(default_factory=dict)
    microscholar_coauthors: list[dict] = field(default_factory=list)

    # MicroLendar
    microlendar_events: list[dict] = field(default_factory=list)
    microlendar_event_states: dict[str, dict] = field(default_factory=dict)
    microlendar_tasks: list[dict] = field(default_factory=list)
    microlendar_task_states: dict[str, dict] = field(default_factory=dict)
    microlendar_user_created_events: list[dict] = field(default_factory=list)
    microlendar_user_created_tasks: list[dict] = field(default_factory=list)
    microlendar_today: str = "2026-03-18"
    microlendar_initial_date: Optional[str] = None

    # MicroTube
    microtube_videos: list[dict] = field(default_factory=list)
    microtube_video_states: dict[str, dict] = field(default_factory=dict)       # id → {isLiked, isDisliked, isSaved}
    microtube_channels: list[dict] = field(default_factory=list)
    microtube_channel_states: dict[str, dict] = field(default_factory=dict)     # id → {isSubscribed}
    microtube_comments: list[dict] = field(default_factory=list)
    microtube_notifications: list[dict] = field(default_factory=list)
    microtube_notification_states: dict[str, dict] = field(default_factory=dict)  # id → {isDismissed, isRead}
    microtube_user_created_comments: list[dict] = field(default_factory=list)
    microtube_user_created_playlists: list[dict] = field(default_factory=list)
    microtube_watched_videos: set[str] = field(default_factory=set)



def build_event_timeline(events: list[dict]) -> list[dict]:
    """Pass through pre-timed events from scenario JSON."""
    return sorted(events, key=lambda e: e["time"])
