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

  const loginAdmin = (secretKey) => {
    setAdminSecretKey(secretKey);
  };

  const logoutAdmin = () => {
    setAdminSecretKey('');
    sessionStorage.removeItem('exampro_admin_secret');
  };

  return (
    <AuthContext.Provider
      value={{
        participant,
        sessionData,
        adminSecretKey,
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
