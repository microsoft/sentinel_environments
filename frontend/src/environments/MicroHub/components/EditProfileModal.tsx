import { useState } from "react";
import { XCircle } from "lucide-react";
import { classNames } from "../utils";
import { useTheme } from "../contexts";
import type { EditableProfileDraft } from "../contexts";
import type { MicroHubUser } from "../index";

interface EditProfileModalProps {
  profile: MicroHubUser;
  editedProfile: EditableProfileDraft | null;
  onClose: () => void;
  onSave: (data: EditableProfileDraft) => void;
}

// Module-scope; consumes ThemeContext for `theme` (was previously a prop).
// `profile`, `editedProfile`, `onClose`, `onSave` remain props because the
// parent ProfileView controls the modal's lifecycle and wires the save
// handler into context state — keeping the API symmetric makes that
// relationship explicit at the call site.
export const EditProfileModal = ({ profile, editedProfile, onClose, onSave }: EditProfileModalProps) => {
  const { theme } = useTheme();
  const [formData, setFormData] = useState<EditableProfileDraft>({
    name: editedProfile?.name ?? profile.name,
    bio: editedProfile?.bio ?? profile.bio,
    company: editedProfile?.company ?? profile.company ?? "",
    location: editedProfile?.location ?? profile.location,
    website: editedProfile?.website ?? profile.website ?? "",
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className={classNames("w-full max-w-lg rounded-lg shadow-xl", theme.bgSecondary)} onClick={e => e.stopPropagation()}>
        <div className={classNames("flex items-center justify-between p-4 border-b", theme.border)}>
          <h2 className="text-lg font-semibold">Edit profile</h2>
          <button onClick={onClose} className={classNames("p-1 rounded", theme.hover)}>
            <XCircle className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className={classNames("block text-sm font-medium mb-1", theme.textSecondary)}>Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className={classNames("w-full px-3 py-2 rounded-md border text-sm", theme.inputBg, theme.border)}
            />
          </div>
          <div>
            <label className={classNames("block text-sm font-medium mb-1", theme.textSecondary)}>Bio</label>
            <textarea
              value={formData.bio}
              onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
              rows={3}
              className={classNames("w-full px-3 py-2 rounded-md border text-sm", theme.inputBg, theme.border)}
            />
          </div>
          <div>
            <label className={classNames("block text-sm font-medium mb-1", theme.textSecondary)}>Company</label>
            <input
              type="text"
              value={formData.company}
              onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
              className={classNames("w-full px-3 py-2 rounded-md border text-sm", theme.inputBg, theme.border)}
            />
          </div>
          <div>
            <label className={classNames("block text-sm font-medium mb-1", theme.textSecondary)}>Location</label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
              className={classNames("w-full px-3 py-2 rounded-md border text-sm", theme.inputBg, theme.border)}
            />
          </div>
          <div>
            <label className={classNames("block text-sm font-medium mb-1", theme.textSecondary)}>Website</label>
            <input
              type="text"
              value={formData.website}
              onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
              placeholder="https://"
              className={classNames("w-full px-3 py-2 rounded-md border text-sm", theme.inputBg, theme.border)}
            />
          </div>
        </div>
        <div className={classNames("flex justify-end gap-2 p-4 border-t", theme.border)}>
          <button
            onClick={onClose}
            className={classNames("px-4 py-2 text-sm rounded-md border", theme.border, theme.hover)}
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(formData)}
            className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 rounded-md text-white"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};
