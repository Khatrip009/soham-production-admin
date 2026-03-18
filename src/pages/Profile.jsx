import { useEffect, useState, useCallback } from "react";
import { supabase } from "../api/supabaseClient";
import { FiSave, FiUpload, FiX } from "react-icons/fi";
import toast, { Toaster } from "react-hot-toast";
import logo from "../assets/sohom_logo.png";
import "./Products.css"; // reuse styling

// Helper to get public URL for an image stored in the "Soham" bucket
const getImageUrl = (path) => {
  if (!path) return "";
  const { data } = supabase.storage.from("Soham").getPublicUrl(path);
  return data.publicUrl;
};

// Helper to get current user ID
const getCurrentUserId = async () => {
  const { data } = await supabase.auth.getUser();
  return data.user?.id;
};

export default function Profile() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // User data from users table
  const [userData, setUserData] = useState({
    email: "",
    full_name: "",
    phone: "",
    role_id: null,
    is_active: true,
  });

  // Profile data from profiles table
  const [profileData, setProfileData] = useState({
    avatar_url: "",
    organization_id: "",
  });

  // Roles list for display
  const [roles, setRoles] = useState([]);
  const [userRole, setUserRole] = useState("");

  // Avatar upload state
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Fetch current user's data
  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const userId = await getCurrentUserId();
      if (!userId) throw new Error("Not authenticated");

      // Fetch user record
      const { data: user, error: userError } = await supabase
        .from("users")
        .select(`
          *,
          role:role_id ( role_name )
        `)
        .eq("id", userId)
        .single();
      if (userError) throw userError;

      // Fetch profile record
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      // If profile doesn't exist, we'll create one later (should exist due to foreign key)
      if (profileError && profileError.code !== "PGRST116") {
        // PGRST116 = no rows returned
        throw profileError;
      }

      setUserData({
        email: user.email,
        full_name: user.full_name || "",
        phone: user.phone || "",
        role_id: user.role_id,
        is_active: user.is_active,
      });
      setUserRole(user.role?.role_name || "Unknown");

      setProfileData({
        avatar_url: profile?.avatar_url || "",
        organization_id: profile?.organization_id || "",
      });

      // Fetch roles for reference (optional)
      const { data: rolesData } = await supabase
        .from("roles")
        .select("id, role_name")
        .order("role_name");
      setRoles(rolesData || []);
    } catch (err) {
      console.error("Error fetching profile:", err);
      setError("Failed to load profile. Please try again.");
      toast.error("Failed to load profile.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Handle form changes
  const handleUserChange = (e) => {
    const { name, value } = e.target;
    setUserData((prev) => ({ ...prev, [name]: value }));
  };

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfileData((prev) => ({ ...prev, [name]: value }));
  };

  // Avatar upload
  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be less than 2MB.");
      return;
    }

    setUploadingAvatar(true);
    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `avatars/${fileName}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from("Soham")
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      // Update local state
      setProfileData((prev) => ({ ...prev, avatar_url: filePath }));
      toast.success("Avatar uploaded");
    } catch (err) {
      console.error("Avatar upload error:", err);
      toast.error("Failed to upload avatar.");
    } finally {
      setUploadingAvatar(false);
      e.target.value = null;
    }
  };

  // Remove avatar
  const handleRemoveAvatar = async () => {
    if (!profileData.avatar_url) return;
    if (!window.confirm("Remove avatar?")) return;

    try {
      await supabase.storage.from("Soham").remove([profileData.avatar_url]);
      setProfileData((prev) => ({ ...prev, avatar_url: "" }));
      toast.success("Avatar removed");
    } catch (err) {
      console.error("Avatar remove error:", err);
      toast.error("Failed to remove avatar.");
    }
  };

  // Save profile
  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const toastId = toast.loading("Saving profile...");

    try {
      const userId = await getCurrentUserId();
      if (!userId) throw new Error("Not authenticated");

      // Update users table
      const { error: userError } = await supabase
        .from("users")
        .update({
          full_name: userData.full_name || null,
          phone: userData.phone || null,
        })
        .eq("id", userId);
      if (userError) throw userError;

      // Update profiles table (upsert)
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert({
          id: userId,
          avatar_url: profileData.avatar_url || null,
          organization_id: profileData.organization_id || null,
        }, { onConflict: "id" });
      if (profileError) throw profileError;

      // Insert notification
      await supabase.from("notifications").insert({
        user_id: userId,
        type: "profile_updated",
        title: "Profile Updated",
        message: "Your profile has been updated.",
      });

      toast.success("Profile saved!", { id: toastId });
    } catch (err) {
      console.error("Save error:", err);
      toast.error("Failed to save profile.", { id: toastId });
      setError(err.message || "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="profile loading">
        <div className="premium-card skeleton-profile" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="profile error">
        <p className="error-message">{error}</p>
        <button onClick={fetchProfile} className="retry-btn">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="profile" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <Toaster position="top-right" />
      <div className="profile-header">
        <h1 className="profile-title">My Profile</h1>
      </div>

      <div className="profile-content premium-card">
        <form onSubmit={handleSave}>
          <div className="profile-avatar-section">
            <h3>Profile Picture</h3>
            <div className="avatar-upload">
              {profileData.avatar_url ? (
                <div className="avatar-preview">
                  <img
                    src={getImageUrl(profileData.avatar_url)}
                    alt="Avatar"
                    className="avatar-img"
                  />
                  <button
                    type="button"
                    className="remove-avatar"
                    onClick={handleRemoveAvatar}
                    aria-label="Remove avatar"
                  >
                    <FiX />
                  </button>
                </div>
              ) : (
                <label className="avatar-placeholder">
                  <FiUpload />
                  <span>Upload Avatar</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    disabled={uploadingAvatar}
                  />
                  {uploadingAvatar && <div className="uploading-spinner" />}
                </label>
              )}
              <p className="avatar-hint">Max 2MB. Square image recommended.</p>
            </div>
          </div>

          <div className="profile-details-section">
            <h3>Account Information</h3>
            <div className="form-grid">
              <div className="form-group">
                <label>Email</label>
                <input type="email" value={userData.email} disabled className="disabled-input" />
              </div>
              <div className="form-group">
                <label>Role</label>
                <input type="text" value={userRole} disabled className="disabled-input" />
              </div>
              <div className="form-group">
                <label>Full Name</label>
                <input
                  type="text"
                  name="full_name"
                  value={userData.full_name}
                  onChange={handleUserChange}
                  placeholder="Your full name"
                />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input
                  type="text"
                  name="phone"
                  value={userData.phone}
                  onChange={handleUserChange}
                  placeholder="Phone number"
                />
              </div>
              <div className="form-group">
                <label>Organization ID (optional)</label>
                <input
                  type="text"
                  name="organization_id"
                  value={profileData.organization_id}
                  onChange={handleProfileChange}
                  placeholder="Organization ID"
                />
              </div>
            </div>
          </div>

          <div className="profile-actions">
            <button type="submit" className="btn-primary" disabled={saving}>
              <FiSave /> {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}