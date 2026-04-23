# pydantic models for fastapi request/response validation.
# server.py uses these as type hints on route parameters and return types.
# request models (e.g. MicrohoodOrderRequest) validate incoming JSON bodies.
# response models (e.g. MicromailEmailResponse) document outgoing shapes.
# naming convention: {Environment}{Entity}{Request|Response}
#
# flow: client request -> server.py route (uses schema for validation) -> handler -> response schema
# example: POST /microhood/stocks/AAPL/order -> MicrohoodOrderRequest validates body -> microhood handler

from __future__ import annotations

from typing import Optional
from pydantic import BaseModel, field_validator

from server.timing import validate_speed_factor


class EventPayload(BaseModel):
    time: float
    type: str
    payload: dict = {}


class InitPayload(BaseModel):
    environment: str
    event_timeline_end: float
    eval_sql: str = ""
    condition_at: Optional[float] = None
    speed_factor: float = 1.0
    events: list[EventPayload]

    @field_validator("speed_factor")
    @classmethod
    def _check_speed_factor(cls, v: float) -> float:
        return validate_speed_factor(v)


# ---------------------------------------------------------------------------
# Shared
# ---------------------------------------------------------------------------

class ConfigResponse(BaseModel):
    environment: str
    event_timeline_end: float
    speed_factor: float = 1.0
    selfUser: Optional[dict] = None


class UsersResponse(BaseModel):
    users: list[dict]


class EvaluateResponse(BaseModel):
    success: bool
    detail: str = ""
    evaluation_time: Optional[float] = None
    condition_at: Optional[float] = None
    contact_get_time: Optional[int] = None
    contact_post_time: Optional[int] = None
    contact_message: Optional[str] = None


# --- Shared POST response models ---

class SuccessResponse(BaseModel):
    success: bool



class ToggleLikeResponse(BaseModel):
    success: bool
    isLiked: bool


class ToggleSaveResponse(BaseModel):
    success: bool
    isSaved: bool


class ToggleFollowResponse(BaseModel):
    success: bool
    isFollowed: bool


class ToggleFollowingResponse(BaseModel):
    success: bool
    isFollowing: bool


class ToggleMuteResponse(BaseModel):
    success: bool
    isMuted: bool


class TogglePinResponse(BaseModel):
    success: bool
    isPinned: bool


class ToggleDislikeResponse(BaseModel):
    success: bool
    isDisliked: bool


class ToggleSubscribeResponse(BaseModel):
    success: bool
    isSubscribed: bool


class ToggleWatchlistResponse(BaseModel):
    success: bool
    inWatchlist: bool


class ToggleCompleteResponse(BaseModel):
    success: bool
    completed: bool


class CommentResponse(BaseModel):
    success: bool
    comment: dict


class OrderResponse(BaseModel):
    success: bool
    order: dict


class StarResponse(BaseModel):
    success: bool
    isStarred: bool
    starCount: int


class WatchResponse(BaseModel):
    success: bool
    isWatched: bool
    watchCount: int


class ForkResponse(BaseModel):
    success: bool
    isForked: bool
    forkCount: int


class StateChangeResponse(BaseModel):
    success: bool
    state: str


class MergeResponse(BaseModel):
    success: bool
    state: Optional[str] = None
    strategy: Optional[str] = None
    error: Optional[str] = None


class CreateEventResponse(BaseModel):
    success: bool
    event: dict


class CreateTaskResponse(BaseModel):
    success: bool
    task: dict


class CreatePlaylistResponse(BaseModel):
    success: bool
    playlist: dict


# ---------------------------------------------------------------------------
# Micromail
# ---------------------------------------------------------------------------

class MicromailEmailResponse(BaseModel):
    emails: list[dict]


class MicromailMoveEmailRequest(BaseModel):
    folder: str


class MicromailSendEmailRequest(BaseModel):
    to: list[str]
    cc: list[str] = []
    bcc: list[str] = []
    subject: str = ""
    body: str = ""
    folder: str = "sent"


class MicromailSendEmailResponse(BaseModel):
    success: bool
    email: dict


# ---------------------------------------------------------------------------
# Microchat
# ---------------------------------------------------------------------------

class MicrochatMessagesResponse(BaseModel):
    messages: list[dict]


class MicrochatConversationsResponse(BaseModel):
    conversations: list[dict]


class MicrochatTeamsResponse(BaseModel):
    teams: list[dict]


class MicrochatCallsResponse(BaseModel):
    calls: list[dict]


class MicrochatReactRequest(BaseModel):
    emoji: str


# ---------------------------------------------------------------------------
# Microdin
# ---------------------------------------------------------------------------

class MicrodinPostsResponse(BaseModel):
    posts: list[dict]


class MicrodinConnectionsResponse(BaseModel):
    connections: list[dict]


class MicrodinConversationsResponse(BaseModel):
    conversations: list[dict]


class MicrodinNotificationsResponse(BaseModel):
    notifications: list[dict]


class MicrodinJobsResponse(BaseModel):
    jobs: list[dict]


class MicrodinCompaniesResponse(BaseModel):
    companies: list[dict]


class MicrodinNetworkResponse(BaseModel):
    users: list[dict]


# ---------------------------------------------------------------------------
# Microgram
# ---------------------------------------------------------------------------

class MicrogramUsersResponse(BaseModel):
    users: list[dict]


# ---------------------------------------------------------------------------
# Microhub
# ---------------------------------------------------------------------------

class MicrohubUsersResponse(BaseModel):
    users: list[dict]


# ---------------------------------------------------------------------------
# Microscholar
# ---------------------------------------------------------------------------

class MicroscholarUsersResponse(BaseModel):
    users: list[dict]


# ---------------------------------------------------------------------------
# Microfy
# ---------------------------------------------------------------------------

class MicrofyTracksResponse(BaseModel):
    tracks: list[dict]


class MicrofyPlaylistsResponse(BaseModel):
    playlists: list[dict]


class MicrofyMoodsResponse(BaseModel):
    moods: list[dict]


class MicrofyFollowedArtistsResponse(BaseModel):
    followed_artists: list[str]


class MicrofyArtistsResponse(BaseModel):
    artists: list[dict]


class MicrofyCreatePlaylistRequest(BaseModel):
    name: str
    description: str = ""


class MicrofyAddToPlaylistRequest(BaseModel):
    track_id: str


# ---------------------------------------------------------------------------
# Microgram
# ---------------------------------------------------------------------------

class MicrogramPostsResponse(BaseModel):
    posts: list[dict]


class MicrogramStoriesResponse(BaseModel):
    stories: list[dict]


class MicrogramMessagesResponse(BaseModel):
    messages: list[dict]


class MicrogramActivityResponse(BaseModel):
    activity: list[dict]


class MicrogramFollowedUsersResponse(BaseModel):
    followed_users: list[str]


class MicrogramCommentRequest(BaseModel):
    text: str


# ---------------------------------------------------------------------------
# Microhood
# ---------------------------------------------------------------------------

class MicrohoodStocksResponse(BaseModel):
    stocks: list[dict]


class MicrohoodWatchlistResponse(BaseModel):
    watchlist: list[dict]


class MicrohoodNewsResponse(BaseModel):
    news: list[dict]


class MicrohoodPortfolioResponse(BaseModel):
    buying_power: float
    positions_value: float
    portfolio_value: float
    total_gain: float
    total_gain_percent: float


class MicrohoodOrderRequest(BaseModel):
    action: str  # "buy" | "sell"
    quantity: int
    type: str = "market"  # "market" | "limit"
    limit_price: float | None = None


# ---------------------------------------------------------------------------
# Microhub
# ---------------------------------------------------------------------------

class MicrohubRepositoryResponse(BaseModel):
    repository: dict

class MicrohubFilesResponse(BaseModel):
    files: list[dict]

class MicrohubIssuesResponse(BaseModel):
    issues: list[dict]

class MicrohubPrsResponse(BaseModel):
    prs: list[dict]

class MicrohubCommitsResponse(BaseModel):
    commits: list[dict]

class MicrohubRunsResponse(BaseModel):
    runs: list[dict]

class MicrohubWorkflowsResponse(BaseModel):
    workflows: list[dict]

class MicrohubWikiResponse(BaseModel):
    pages: list[dict]

class MicrohubProjectsResponse(BaseModel):
    projects: list[dict]

class MicrohubActivityResponse(BaseModel):
    activity: list[dict]

class MicrohubInsightsResponse(BaseModel):
    insights: list[dict]

class MicrohubReleasesResponse(BaseModel):
    releases: list[dict]

class MicrohubLabelsResponse(BaseModel):
    labels: list[dict]

class MicrohubSecurityResponse(BaseModel):
    advisories: list[dict]

class MicrohubCodeScanningResponse(BaseModel):
    alerts: list[dict]

class MicrohubSettingsResponse(BaseModel):
    settings: dict

class MicrohubDeploymentsResponse(BaseModel):
    deployments: list[dict]

class MicrohubPackagesResponse(BaseModel):
    packages: list[dict]

class MicrohubFollowingResponse(BaseModel):
    following: list[str]


class MicrohubCommentRequest(BaseModel):
    body: str

class MicrohubMergeRequest(BaseModel):
    strategy: str = "merge"  # "merge" | "squash" | "rebase"


# ---------------------------------------------------------------------------
# Microscholar
# ---------------------------------------------------------------------------

class MicroscholarPapersResponse(BaseModel):
    papers: list[dict]


class MicroscholarPaperDetailResponse(BaseModel):
    paper: dict


class MicroscholarAlertsResponse(BaseModel):
    alerts: list[dict]


class MicroscholarCoauthorsResponse(BaseModel):
    coauthors: list[dict]


# ---------------------------------------------------------------------------
# Microlendar
# ---------------------------------------------------------------------------

class MicrolendarEventsResponse(BaseModel):
    events: list[dict]


class MicrolendarTasksResponse(BaseModel):
    tasks: list[dict]


class MicrolendarCreateEventRequest(BaseModel):
    title: str
    date: str
    time: str = "09:00"
    endTime: str = "10:00"
    calendar: str = "Work"
    description: str = ""
    location: str = ""


class MicrolendarUpdateEventRequest(BaseModel):
    title: Optional[str] = None
    date: Optional[str] = None
    time: Optional[str] = None
    endTime: Optional[str] = None
    calendar: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None


class MicrolendarCreateTaskRequest(BaseModel):
    title: str
    dueDate: Optional[str] = None


# ---------------------------------------------------------------------------
# Microtube
# ---------------------------------------------------------------------------

class MicrotubeVideosResponse(BaseModel):
    videos: list[dict]


class MicrotubeChannelsResponse(BaseModel):
    channels: list[dict]


class MicrotubeCommentsResponse(BaseModel):
    comments: list[dict]


class MicrotubeNotificationsResponse(BaseModel):
    notifications: list[dict]


class MicrotubePlaylistsResponse(BaseModel):
    playlists: list[dict]


class MicrotubeVideoDetailResponse(BaseModel):
    video: dict


class MicrotubeChannelDetailResponse(BaseModel):
    channel: dict


class MicrotubeCommentRequest(BaseModel):
    video_id: str
    content: str


class MicrotubeCreatePlaylistRequest(BaseModel):
    name: str


class MicrotubeAddToPlaylistRequest(BaseModel):
    video_id: str
