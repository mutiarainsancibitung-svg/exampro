import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  // Peserta state
  const [participant, setParticipant] = useState(() => {
    const saved = sessionStorage.getItem('exampro_participant');
    return saved ? JSON.parse(saved) : null;
  });

  const [sessionData, setSessionData] = useState(() => {
    const saved = sessionStorage.getItem('exampro_session');
    return saved ? JSON.parse(saved) : null;
  });

  // Admin state
  const [adminSecretKey, setAdminSecretKey] = useState(() => {
    return sessionStorage.getItem('exampro_admin_secret') || '';
  });

  const [adminUser, setAdminUser] = useState(() => {
    const saved = sessionStorage.getItem('exampro_admin_user');
    return saved ? JSON.parse(saved) : null;
  });

  // Simpan ke sessionStorage setiap ada perubahan
  useEffect(() => {
    if (participant) {
      sessionStorage.setItem('exampro_participant', JSON.stringify(participant));
    } else {
      sessionStorage.removeItem('exampro_participant');
    }
  }, [participant]);

  useEffect(() => {
    if (sessionData) {
      sessionStorage.setItem('exampro_session', JSON.stringify(sessionData));
    } else {
      sessionStorage.removeItem('exampro_session');
    }
  }, [sessionData]);

  useEffect(() => {
    if (adminSecretKey) {
      sessionStorage.setItem('exampro_admin_secret', adminSecretKey);
    } else {
      sessionStorage.removeItem('exampro_admin_secret');
    }
  }, [adminSecretKey]);

  useEffect(() => {
    if (adminUser) {
      sessionStorage.setItem('exampro_admin_user', JSON.stringify(adminUser));
    } else {
      sessionStorage.removeItem('exampro_admin_user');
    }
  }, [adminUser]);

  const loginParticipant = (participantInfo, sessionInfo) => {
    setParticipant(participantInfo);
    setSessionData(sessionInfo);
  };

  const logoutParticipant = () => {
    setParticipant(null);
    setSessionData(null);
    sessionStorage.removeItem('exampro_participant');
    sessionStorage.removeItem('exampro_session');
  };

  const loginAdmin = (secretKey, userData = null) => {
    setAdminSecretKey(secretKey);
    const resolvedUser = userData || {
      admin_id: 'ADM-001',
      username: 'admin',
      name: 'Administrator Utama',
      role: 'superadmin'
    };
    setAdminUser(resolvedUser);
  };

  const logoutAdmin = () => {
    setAdminSecretKey('');
    setAdminUser(null);
    sessionStorage.removeItem('exampro_admin_secret');
    sessionStorage.removeItem('exampro_admin_user');
  };

  return (
    <AuthContext.Provider
      value={{
        participant,
        sessionData,
        adminSecretKey,
        adminUser,
        adminRole: adminUser?.role || 'superadmin',
        isAdminLoggedIn: Boolean(adminSecretKey),
        isParticipantLoggedIn: Boolean(participant && sessionData),
        loginParticipant,
        logoutParticipant,
        loginAdmin,
        logoutAdmin
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
