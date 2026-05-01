import {
  Star,
  GitFork,
  GitMerge,
  GitCommit,
  GitPullRequest,
  CircleDot,
  MessageSquare,
  Tag,
  BookOpen,
  Users,
  Building2,
  MapPin,
  Mail,
} from "lucide-react";
import { classNames, getInitials, getAvatarColor, computeRelativeTimestamp } from "../utils";
import { useTheme, useMicrohubCtx, useMicrohubUI } from "../contexts";
import { EditProfileModal } from "./EditProfileModal";

export const ProfileView = () => {
  const { theme } = useTheme();
  const {
    repository,
    activity,
    followingUsernames,
    userCreatedRepos,
    viewingProfile,
    startTime,
    followUser,
  } = useMicrohubCtx();
  const {
    setRoute,
    editedProfile,
    setEditedProfile,
    editProfileOpen,
    setEditProfileOpen,
    hoveredContribution,
    setHoveredContribution,
  } = useMicrohubUI();

  const baseProfile = viewingProfile;
  if (!baseProfile) return null;

  // Apply edited profile data for self user
  const profile = baseProfile.isSelf && editedProfile ? {
    ...baseProfile,
    name: editedProfile.name,
    bio: editedProfile.bio,
    company: editedProfile.company,
    location: editedProfile.location,
    website: editedProfile.website,
  } : baseProfile;

  const isFollowing = followingUsernames.includes(profile.username);
  const displayedFollowers = profile.followers + (isFollowing ? 1 : 0);

  const handleFollowToggle = () => {
    if (profile.isSelf) return;
    followUser(profile.username);
  };

  // Generate contribution graph data as 7 rows (days) x 52 columns (weeks)
  // Shows Sun-Sat vertically, weeks horizontally
  const getContributionGrid = () => {
    if (!profile.contributionData) return null;

    // Data has 52 weekly values - expand to 364 daily values with variance
    const weeklyData = profile.contributionData;
    const weeks: number[][] = [];

    // Seeded pseudo-random based on username for consistent variance
    const seed = profile.username.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

    // Organize data into weeks (columns) with 7 days (rows) each
    for (let week = 0; week < 52; week++) {
      const weekTotal = weeklyData[week] ?? 0;
      const weekData: number[] = [];

      // Distribute weekly contributions across 7 days with variance
      for (let day = 0; day < 7; day++) {
        // Use deterministic pseudo-random based on week, day, and seed
        const pseudoRandom = Math.sin(seed + week * 7 + day) * 10000;
        const variance = (pseudoRandom - Math.floor(pseudoRandom));

        // Weekends typically have less activity
        const isWeekend = day === 0 || day === 6;
        const baseMultiplier = isWeekend ? 0.3 : 1.2;

        // Calculate daily contribution with variance
        const dailyContribution = Math.max(0, Math.round(
          (weekTotal / 7) * baseMultiplier * (0.5 + variance)
        ));

        weekData.push(dailyContribution);
      }
      weeks.push(weekData);
    }

    return weeks;
  };

  const contributionGrid = getContributionGrid();
  const totalContributions = profile.contributionData?.reduce((a, b) => a + b, 0) ?? 0;

  const getContributionColor = (count: number) => {
    if (count === 0) return theme.contribEmpty;
    if (count < 3) return "#0e4429";
    if (count < 6) return "#006d32";
    if (count < 9) return "#26a641";
    return "#39d353";
  };

  const dayLabels = ["Sun", "", "Tue", "", "Thu", "", "Sat"];
  const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return (
    <div className="max-w-6xl mx-auto p-4">
      <div className="flex flex-col md:flex-row gap-8">
        {/* Left column - Profile info */}
        <div className="w-full md:w-72 space-y-4">
          <div className="flex flex-col items-center md:items-start">
            {profile.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt={profile.name}
                className="w-64 h-64 rounded-full object-cover mb-4"
              />
            ) : (
              <div
                className="w-64 h-64 rounded-full flex items-center justify-center text-6xl text-white font-bold mb-4"
                style={{ backgroundColor: getAvatarColor(profile.name) }}
              >
                {getInitials(profile.name)}
              </div>
            )}
            <h1 className="text-2xl font-bold">{profile.name}</h1>
            <p className={classNames("text-xl", theme.textSecondary)}>{profile.username}</p>
          </div>

          <p className={classNames("text-sm", theme.textSecondary)}>{profile.bio}</p>

          {profile.isSelf ? (
            <button
              className={classNames("w-full px-4 py-1.5 text-sm border rounded-md", theme.border, theme.hover)}
              onClick={() => setEditProfileOpen(true)}
            >
              Edit profile
            </button>
          ) : (
            <button
              onClick={handleFollowToggle}
              className={classNames(
                "w-full px-4 py-1.5 text-sm rounded-md font-medium",
                isFollowing
                  ? classNames("border", theme.border, theme.hover, "hover:border-red-500 hover:text-red-400")
                  : "bg-[#238636] hover:bg-[#2ea043] text-white"
              )}
            >
              {isFollowing ? "Following" : "Follow"}
            </button>
          )}

          <div className="flex items-center space-x-2 text-sm">
            <Users className={classNames("w-4 h-4", theme.textSecondary)} />
            <span><strong>{displayedFollowers}</strong> followers</span>
            <span className={theme.textSecondary}>·</span>
            <span><strong>{profile.following}</strong> following</span>
          </div>

          <div className={classNames("space-y-2 text-sm", theme.textSecondary)}>
            <div className="flex items-center space-x-2">
              <Building2 className="w-4 h-4" />
              <span>{profile.jobTitle}</span>
            </div>
            <div className="flex items-center space-x-2">
              <MapPin className="w-4 h-4" />
              <span>{profile.location}</span>
            </div>
            <div className="flex items-center space-x-2">
              <Mail className="w-4 h-4" />
              <span>{profile.email}</span>
            </div>
          </div>

          {/* Achievements */}
          {profile.achievements && profile.achievements.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Achievements</h3>
              <div className="flex flex-wrap gap-2">
                {profile.achievements.map(ach => (
                  <div key={ach.id} className={classNames("flex items-center space-x-1 px-2 py-1 rounded-full text-sm", theme.bgTertiary)} title={ach.description}>
                    <span>{ach.icon}</span>
                    <span>{ach.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column - Content */}
        <div className="flex-1 space-y-6">
          {/* Pinned Repos - Now FIRST */}
          {repository && (
            <div>
              <h3 className="font-semibold mb-3">Pinned</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className={classNames("border rounded-md p-4", theme.border)}>
                  <div className="flex items-center space-x-2 mb-2">
                    <BookOpen className={classNames("w-4 h-4", theme.textSecondary)} />
                    <a href="#" onClick={(e) => { e.preventDefault(); setRoute("code"); }} className="text-blue-400 hover:underline font-semibold">
                      {repository.fullName}
                    </a>
                    <span className={classNames("text-xs border rounded-full px-2 py-0.5", theme.border, theme.textSecondary)}>Public</span>
                  </div>
                  <p className={classNames("text-sm mb-3", theme.textSecondary)}>{repository.description}</p>
                  <div className={classNames("flex items-center space-x-4 text-xs", theme.textSecondary)}>
                    <span className="flex items-center">
                      <span className="w-3 h-3 rounded-full mr-1" style={{ backgroundColor: repository.languageColor }} />
                      {repository.language}
                    </span>
                    <span className="flex items-center">
                      <Star className="w-3 h-3 mr-1" />{repository.stars.toLocaleString()}
                    </span>
                    <span className="flex items-center">
                      <GitFork className="w-3 h-3 mr-1" />{repository.forks}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* User-created repositories */}
          {profile.isSelf && userCreatedRepos.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3">Repositories</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {userCreatedRepos.map((r) => (
                  <div key={r.id} className={classNames("border rounded-md p-4", theme.border)}>
                    <div className="flex items-center space-x-2 mb-2">
                      <BookOpen className={classNames("w-4 h-4", theme.textSecondary)} />
                      <span className="text-blue-400 font-semibold">{r.fullName}</span>
                      <span className={classNames("text-xs border rounded-full px-2 py-0.5", theme.border, theme.textSecondary)}>
                        {r.isPrivate ? "Private" : "Public"}
                      </span>
                    </div>
                    {r.description && <p className={classNames("text-sm mb-3", theme.textSecondary)}>{r.description}</p>}
                    <div className={classNames("flex items-center space-x-4 text-xs", theme.textSecondary)}>
                      <span className="flex items-center">
                        <Star className="w-3 h-3 mr-1" />{r.stars}
                      </span>
                      <span className="flex items-center">
                        <GitFork className="w-3 h-3 mr-1" />{r.forks}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Contribution Graph - Now BELOW Pinned Repos */}
          {contributionGrid && (
            <div className={classNames("border rounded-md p-4", theme.border)}>
              <h3 className="font-semibold mb-3">{totalContributions} contributions in the last year</h3>

              {/* Month labels */}
              <div className="flex mb-1 ml-8">
                {monthLabels.map((month, i) => (
                  <span key={i} className={classNames("text-xs", theme.textMuted)} style={{ width: `${100/12}%` }}>{month}</span>
                ))}
              </div>

              {/* Grid container */}
              <div className="flex">
                {/* Day labels */}
                <div className="flex flex-col justify-between pr-2" style={{ height: "calc(7 * 11px + 6 * 2px)" }}>
                  {dayLabels.map((day, i) => (
                    <span key={i} className={classNames("text-xs leading-none", theme.textMuted)} style={{ height: "11px", lineHeight: "11px" }}>{day}</span>
                  ))}
                </div>

                {/* Contribution squares - 52 columns x 7 rows */}
                <div className="flex gap-0.5 overflow-x-auto relative">
                  {contributionGrid.map((week, weekIndex) => (
                    <div key={weekIndex} className="flex flex-col gap-0.5">
                      {week.map((count, dayIndex) => {
                        // Calculate approximate date for this cell
                        const daysAgo = (51 - weekIndex) * 7 + (6 - dayIndex);
                        const cellDate = new Date();
                        cellDate.setDate(cellDate.getDate() - daysAgo);
                        const dateStr = cellDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

                        return (
                          <div
                            key={`${weekIndex}-${dayIndex}`}
                            className="w-[11px] h-[11px] rounded-sm cursor-pointer"
                            style={{ backgroundColor: getContributionColor(count) }}
                            onMouseEnter={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setHoveredContribution({
                                week: weekIndex,
                                day: dayIndex,
                                count,
                                x: rect.left + rect.width / 2,
                                y: rect.top
                              });
                            }}
                            onMouseLeave={() => setHoveredContribution(null)}
                            title={`${count} contribution${count !== 1 ? 's' : ''} on ${dateStr}`}
                          />
                        );
                      })}
                    </div>
                  ))}
                  {/* Hover tooltip */}
                  {hoveredContribution && contributionGrid && (
                    <div
                      className="fixed z-50 px-2 py-1 text-xs bg-[#1b1f23] text-white border border-gray-600 rounded shadow-lg whitespace-nowrap pointer-events-none"
                      style={{
                        left: hoveredContribution.x,
                        top: hoveredContribution.y - 30,
                        transform: 'translateX(-50%)'
                      }}
                    >
                      <strong>{hoveredContribution.count} contribution{hoveredContribution.count !== 1 ? 's' : ''}</strong>
                      <span className="text-gray-400 ml-1">
                        on {(() => {
                          const daysAgo = (51 - hoveredContribution.week) * 7 + (6 - hoveredContribution.day);
                          const cellDate = new Date();
                          cellDate.setDate(cellDate.getDate() - daysAgo);
                          return cellDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                        })()}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Legend */}
              <div className={classNames("flex items-center justify-end mt-2 gap-1 text-xs", theme.textMuted)}>
                <span>Less</span>
                {[0, 2, 5, 8, 12].map((level) => (
                  <div
                    key={level}
                    className="w-[11px] h-[11px] rounded-sm"
                    style={{ backgroundColor: getContributionColor(level) }}
                  />
                ))}
                <span>More</span>
              </div>
            </div>
          )}

          {/* Recent Activity */}
          <div>
            <h3 className="font-semibold mb-3">Recent activity</h3>
            <div className="space-y-3">
              {activity.filter(e => e.actor === profile.username).slice(0, 5).map(event => (
                <div key={event.id} className="flex items-start space-x-3 text-sm">
                  <div className={classNames("w-8 h-8 rounded-full flex items-center justify-center", theme.bgTertiary)}>
                    {event.type === "push" && <GitCommit className="w-4 h-4 text-green-500" />}
                    {event.type === "pr_opened" && <GitPullRequest className="w-4 h-4 text-green-500" />}
                    {event.type === "pr_merged" && <GitMerge className="w-4 h-4 text-purple-500" />}
                    {event.type === "issue_opened" && <CircleDot className="w-4 h-4 text-green-500" />}
                    {event.type === "comment" && <MessageSquare className="w-4 h-4 text-blue-500" />}
                    {event.type === "star" && <Star className="w-4 h-4 text-yellow-500" />}
                    {event.type === "release" && <Tag className="w-4 h-4 text-green-500" />}
                  </div>
                  <div>
                    <p className={theme.textSecondary}>
                      {event.type === "push" && `Pushed to ${(event.payload as { branch?: string }).branch}`}
                      {event.type === "pr_opened" && `Opened PR #${(event.payload as { number?: number }).number}`}
                      {event.type === "pr_merged" && `Merged PR #${(event.payload as { number?: number }).number}`}
                      {event.type === "issue_opened" && `Opened issue #${(event.payload as { number?: number }).number}`}
                      {event.type === "comment" && `Commented on ${(event.payload as { type?: string }).type} #${(event.payload as { number?: number }).number}`}
                      {event.type === "star" && `Starred ${event.repo}`}
                      {event.type === "release" && `Released ${(event.payload as { tagName?: string }).tagName}`}
                    </p>
                    <p className={classNames("text-xs", theme.textMuted)}>{computeRelativeTimestamp(event.order, startTime)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {editProfileOpen && profile.isSelf && (
        <EditProfileModal
          profile={profile}
          editedProfile={editedProfile}
          onClose={() => setEditProfileOpen(false)}
          onSave={(data) => {
            setEditedProfile(data);
            setEditProfileOpen(false);
          }}
        />
      )}
    </div>
  );
};
