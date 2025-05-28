import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import SIRCMS_ARTIFACT from './contracts/SIRCMS.json'; // Ensure this path is correct
import './App.css';

// Load environment variables for the frontend
const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;

function App() {
  const [currentAccount, setCurrentAccount] = useState(null);
  const [contractInstance, setContractInstance] = useState(null);
  const [balance, setBalance] = useState(null);
  const [error, setError] = useState(null);
  const [contractOwner, setContractOwner] = useState(null);
  const [isOwner, setIsOwner] = useState(false);

  // State for Tab Navigation
  const [selectedTab, setSelectedTab] = useState('registerInstitution'); // Default tab

  // State for general success/info messages
  const [message, setMessage] = useState('');

  // --- Institution Management States ---
  // State for Institution Registration form
  const [newInstitutionAddress, setNewInstitutionAddress] = useState('');
  const [newInstitutionName, setNewInstitutionName] = useState('');
  const [newInstitutionCode, setNewInstitutionCode] = useState('');

  // State for displaying registered institutions
  const [registeredInstitutions, setRegisteredInstitutions] = useState([]);

  // --- Credential Storage States ---
  // State for Credential Form
  const [newStudentId, setNewStudentId] = useState('');
  const [newSchoolId, setNewSchoolId] = useState('');
  const [newStudentName, setNewStudentName] = useState('');
  const [newDateOfBirth, setNewDateOfBirth] = useState('');
  const [newInstitutionNameCredential, setNewInstitutionNameCredential] = useState('');
  const [newCertificateTitle, setNewCertificateTitle] = useState('');
  const [newIssueDate, setNewIssueDate] = useState('');
  const [newExpiryDate, setNewExpiryDate] = useState('');
  const [newDocumentHash, setNewDocumentHash] = useState('');

  // --- Credential Search States ---
  const [searchStudentId, setSearchStudentId] = useState('');
  const [searchSchoolId, setSearchSchoolId] = useState('');
  const [searchResult, setSearchResult] = useState(null); // Will store the fetched credential data
  const [searchMessage, setSearchMessage] = useState(''); // Specific message for search

  // --- Credential Revoke States ---
  const [revokeStudentId, setRevokeStudentId] = useState('');
  const [revokeSchoolId, setRevokeSchoolId] = useState('');
  const [revokeMessage, setRevokeMessage] = useState(''); // Specific message for revoke

  // --- Credential Verify States ---
  const [verifyStudentId, setVerifyStudentId] = useState('');
  const [verifySchoolId, setVerifySchoolId] = useState('');
  const [verifyDocumentHash, setVerifyDocumentHash] = useState('');
  const [verifyResult, setVerifyResult] = useState(null); // { isValid, isRevoked, isExpired }
  const [verifyMessage, setVerifyMessage] = useState(''); // Specific message for verify


  useEffect(() => {
    console.log("useEffect: Running initial wallet check and setting up listeners.");
    checkWalletConnection(); // Initial check on mount

    if (window.ethereum) {
      // Define handlers for consistent removal
      const handleAccounts = (accounts) => handleAccountsChanged(accounts);
      const handleChain = (chainId) => handleChainChanged(chainId);

      window.ethereum.on('accountsChanged', handleAccounts);
      window.ethereum.on('chainChanged', handleChain);
      // Optional: Add connect/disconnect listeners for more detailed debugging
      window.ethereum.on('connect', (info) => console.log("MetaMask connected:", info));
      window.ethereum.on('disconnect', (err) => console.log("MetaMask disconnected:", err));

      return () => {
        console.log("useEffect: Cleaning up event listeners.");
        window.ethereum.removeListener('accountsChanged', handleAccounts);
        window.ethereum.removeListener('chainChanged', handleChain);
        // Remove optional listeners as well if added
        window.ethereum.removeListener('connect', (info) => console.log("MetaMask connected:", info));
        window.ethereum.removeListener('disconnect', (err) => console.log("MetaMask disconnected:", err));
      };
    }
  }, []); // Empty dependency array means this runs once on mount and cleanup on unmount

  useEffect(() => {
    if (contractInstance) {
      console.log("contractInstance changed, fetching all institutions.");
      fetchAllInstitutions();
    }
  }, [contractInstance]); // Only runs when contractInstance state changes


  const handleAccountsChanged = (accounts) => {
    console.log("accountsChanged event fired:", accounts);
    if (accounts.length === 0) {
      console.log('No accounts found. Disconnecting.');
      setCurrentAccount(null);
      setContractInstance(null);
      setBalance(null);
      setError(null);
      setContractOwner(null);
      setIsOwner(false);
      setRegisteredInstitutions([]);
    } else if (accounts[0].toLowerCase() !== currentAccount?.toLowerCase()) { // Only update if account actually changed
      console.log(`Account changed from ${currentAccount} to ${accounts[0]}`);
      setCurrentAccount(accounts[0]);
      initializeContract(accounts[0]); // Re-initialize contract for the new account
    }
  };

  const handleChainChanged = (chainId) => {
    console.log("chainChanged event fired:", chainId);
    // Reloading the page is the simplest way to handle chain changes
    window.location.reload();
  };

  const checkWalletConnection = async () => {
    console.log("checkWalletConnection: Attempting to check MetaMask accounts.");
    if (typeof window.ethereum !== 'undefined') {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          console.log("checkWalletConnection: Found connected account:", accounts[0]);
          // If already connected and initialized, no need to re-initialize unless account changed
          if (accounts[0].toLowerCase() !== currentAccount?.toLowerCase() || !contractInstance) {
            setCurrentAccount(accounts[0]);
            await initializeContract(accounts[0]); // Await this to ensure state is set before proceeding
          } else {
            console.log("checkWalletConnection: Account already set and contract initialized. Skipping.");
            setError(null); // Clear any lingering errors if connection is stable
          }
        } else {
          console.log("checkWalletConnection: No authorized accounts found.");
          setCurrentAccount(null);
          setContractInstance(null);
          setBalance(null);
          setError("Please connect your MetaMask wallet.");
        }
      } catch (err) {
        console.error("checkWalletConnection Error:", err);
        setError("Error checking wallet connection. See console for details.");
      }
    } else {
      console.log("checkWalletConnection: MetaMask not installed.");
      setError("MetaMask is not installed. Please install it to use this dApp.");
    }
  };

  const connectWallet = async () => {
    console.log("connectWallet: Attempting to connect MetaMask.");
    if (typeof window.ethereum !== 'undefined') {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        setCurrentAccount(accounts[0]);
        await initializeContract(accounts[0]);
        setError(null);
        console.log("connectWallet: Wallet connected and contract initialized.");
      } catch (err) {
        console.error("connectWallet Error:", err);
        if (err.code === 4001) {
          setError("Connection rejected by user. Please approve in MetaMask.");
        } else {
          setError("Error connecting to wallet. See console for details.");
        }
      }
    } else {
      setError("MetaMask is not installed. Please install it to use this dApp.");
    }
  };

  const initializeContract = async (account) => {
    console.log(`initializeContract: Attempting to initialize contract for account: ${account}`);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const network = await provider.getNetwork();
      const sepoliaChainId = BigInt(11155111);
      console.log(`initializeContract: Current Chain ID: ${network.chainId}. Expected Sepolia: ${sepoliaChainId}`);

      if (network.chainId !== sepoliaChainId) {
          console.warn("initializeContract: Wrong network detected. Please switch to Sepolia.");
          setError("Please switch your MetaMask to the Sepolia Test Network (Chain ID: 11155111).");
          // Crucial: Only set these states if they are not already set to prevent re-render loops
          // If contractInstance is null and error is set, don't keep resetting it.
          setContractInstance(null);
          setBalance(null);
          setContractOwner(null);
          setIsOwner(false);
          return; // Exit early if on the wrong network
      } else {
          setError(null); // Clear network error if chain is correct
      }

      // Only re-instantiate contract if necessary (e.g., first time, or network/account changes)
      if (!contractInstance || contractInstance.address !== CONTRACT_ADDRESS || contractInstance.runner.address.toLowerCase() !== account.toLowerCase()) {
        const contract = new ethers.Contract(CONTRACT_ADDRESS, SIRCMS_ARTIFACT.abi, signer);
        setContractInstance(contract);
        console.log("initializeContract: SIRCMS Contract instance created.", contract);
        const ownerAddress = await contract.owner();
        setContractOwner(ownerAddress);
        setIsOwner(account.toLowerCase() === ownerAddress.toLowerCase());
        const accBalance = await provider.getBalance(account);
        setBalance(ethers.formatEther(accBalance));
        console.log("initializeContract: Contract initialization completed.");
      } else {
        console.log("initializeContract: Contract already initialized for this account/address. Skipping redundant initialization.");
        // Re-fetch balance and owner status in case they changed (less likely but safer)
        const accBalance = await provider.getBalance(account);
        setBalance(ethers.formatEther(accBalance));
        const ownerAddress = await contractInstance.owner(); // Use existing instance if possible
        setContractOwner(ownerAddress);
        setIsOwner(account.toLowerCase() === ownerAddress.toLowerCase());
      }

    } catch (err) {
      console.error("initializeContract Error:", err);
      // More specific error handling for contract initialization issues
      if (err.message.includes("could not detect network")) {
        setError("Could not connect to Ethereum network. Ensure MetaMask is connected and valid RPC is configured.");
      } else if (err.message.includes("network does not support ENS")) {
        setError("Invalid contract address or ABI, or network misconfiguration. Check CONTRACT_ADDRESS.");
      } else {
        setError(`Error initializing contract: ${err.message}. See console for details.`);
      }
      setContractInstance(null);
      setBalance(null);
      setContractOwner(null);
      setIsOwner(false);
    }
  };


  const registerInstitution = async () => {
    if (!contractInstance) {
      setError("Contract not initialized.");
      return;
    }
    if (!isOwner) {
      setError("Only the contract owner can register institutions.");
      return;
    }
    if (!newInstitutionAddress || !newInstitutionName || !newInstitutionCode) {
      setError("All institution fields are required.");
      return;
    }
    setMessage('');
    setError(null);

    try {
      const codeNum = parseInt(newInstitutionCode);
      if (isNaN(codeNum) || codeNum < 100000000 || codeNum > 999999999) {
        setError("Institution code must be a 9-digit number.");
        return;
      }

      setMessage("Registering institution... Please confirm in MetaMask.");
      const tx = await contractInstance.registerInstitution(
        newInstitutionAddress,
        newInstitutionName,
        codeNum
      );

      console.log("Register Institution Transaction sent:", tx.hash);
      setMessage(`Transaction sent: ${tx.hash}. Waiting for confirmation...`);

      await tx.wait();

      const successMsg = `Institution '${newInstitutionName}' registered successfully! Transaction confirmed.`;
      console.log("Institution registration success message:", successMsg);
      setMessage(successMsg);
      setTimeout(() => { setMessage(''); }, 5000);

      setNewInstitutionAddress('');
      setNewInstitutionName('');
      setNewInstitutionCode('');
      fetchAllInstitutions();

    } catch (err) {
      console.error("Error registering institution:", err);
      if (err.code === 4001) {
        setError("Transaction rejected by user.");
      } else {
        const revertReason = err.reason || err.data?.message || err.message;
        if (revertReason.includes("Institution already registered")) {
            setError("Failed to register: Institution address already registered.");
        } else if (revertReason.includes("Institution code already exists")) {
            setError("Failed to register: Institution code already exists.");
        } else {
            setError(`Failed to register institution: ${revertReason}`);
        }
      }
      setMessage('');
    }
  };

  const fetchAllInstitutions = async () => {
    if (!contractInstance) {
      console.log("Contract not initialized, cannot fetch institutions.");
      return;
    }
    setError(null);
    try {
      setMessage("Fetching registered institutions...");
      const addresses = await contractInstance.getAllRegisteredInstitutionAddresses();
      const institutionsData = [];

      for (const addr of addresses) {
        try {
          const inst = await contractInstance.institutionsData(addr);
          institutionsData.push({
            address: inst.institutionAddress,
            name: inst.name,
            code: Number(inst.code)
          });
        } catch (detailError) {
          console.error(`Error fetching details for institution ${addr}:`, detailError);
          institutionsData.push({ address: addr, name: "Error fetching", code: 0 });
        }
      }
      setRegisteredInstitutions(institutionsData);
      const successMsg = "Registered institutions fetched successfully.";
      console.log("Fetch institutions success message:", successMsg);
      setMessage(successMsg);
      setTimeout(() => { setMessage(''); }, 5000);
      console.log("Registered Institutions:", institutionsData);
    }
    catch (err) {
      console.error("Error fetching all institutions:", err);
      setError(`Failed to fetch institutions: ${err.reason || err.message}`);
      setMessage('');
    }
  };

  const storeCredential = async () => {
    if (!contractInstance) {
      setError("Contract not initialized.");
      return;
    }
    const isRegisteredInstitution = registeredInstitutions.some(inst => inst.address.toLowerCase() === currentAccount.toLowerCase());
    if (!isOwner && !isRegisteredInstitution) {
        setError("Only the contract owner or a registered institution can issue credentials.");
        return;
    }
    if (!newStudentId || !newSchoolId || !newStudentName || !newDateOfBirth || !newInstitutionNameCredential || !newCertificateTitle || !newIssueDate || !newDocumentHash) {
      setError("All credential fields except Expiry Date are required.");
      return;
    }
    setMessage('');
    setError(null);

    try {
      const dobTimestamp = Math.floor(new Date(newDateOfBirth).getTime() / 1000);
      const issueTimestamp = Math.floor(new Date(newIssueDate).getTime() / 1000);
      const expiryTimestamp = newExpiryDate ? Math.floor(new Date(newExpiryDate).getTime() / 1000) : 0;

      if (isNaN(dobTimestamp) || dobTimestamp <= 0) {
        setError("Invalid Date of Birth.");
        return;
      }
      if (isNaN(issueTimestamp) || issueTimestamp <= 0) {
        setError("Invalid Issue Date.");
        return;
      }
      if (expiryTimestamp !== 0 && expiryTimestamp < issueTimestamp) {
        setError("Expiry Date cannot be before Issue Date.");
        return;
      }
      if (newDocumentHash.trim() === '') {
          setError("Document Hash (IPFS CID/URL) cannot be empty.");
          return;
      }

      setMessage("Storing credential... Please confirm in MetaMask.");
      const tx = await contractInstance.storeCredential(
        newStudentId,
        newSchoolId,
        newStudentName,
        dobTimestamp,
        newInstitutionNameCredential,
        newCertificateTitle,
        issueTimestamp,
        expiryTimestamp,
        newDocumentHash
      );

      console.log("Store Credential Transaction sent:", tx.hash);
      setMessage(`Transaction sent: ${tx.hash}. Waiting for confirmation...`);

      await tx.wait();

      const successMsg = `Credential for '${newStudentName}' (${newCertificateTitle}) stored successfully! Transaction confirmed.`;
      console.log("Store Credential success message:", successMsg);
      setMessage(successMsg);
      setTimeout(() => { setMessage(''); }, 5000);

      setNewStudentId('');
      setNewSchoolId('');
      setNewStudentName('');
      setNewDateOfBirth('');
      setNewInstitutionNameCredential('');
      setNewCertificateTitle('');
      setNewIssueDate('');
      setNewExpiryDate('');
      setNewDocumentHash('');

    } catch (err) {
      console.error("Error storing credential:", err);
      if (err.code === 4001) {
        setError("Transaction rejected by user.");
      } else {
        const revertReason = err.reason || err.data?.message || err.message;
        if (revertReason.includes("Credential already exists")) {
            setError("Failed to store credential: Credential with this Student ID and School ID already exists.");
        } else {
            setError(`Failed to store credential: ${revertReason}`);
        }
      }
      setMessage('');
    }
  };


  // --- NEW: Search Credential Function ---
  const searchCredential = async () => {
    if (!contractInstance) {
      setSearchMessage("Contract not initialized.");
      return;
    }
    if (!searchStudentId || !searchSchoolId) {
      setSearchMessage("Please enter both Student ID and School ID to search.");
      setSearchResult(null);
      return;
    }
    setSearchMessage("Searching for credential...");
    setError(null);

    try {
      // The contract's searchCredential returns a tuple of values
      const result = await contractInstance.searchCredential(searchStudentId, searchSchoolId);
      console.log("Raw search result:", result);

      // Ethers.js often returns BigInt for uint256, convert dates and IDs for display
      setSearchResult({
        studentId: Number(result[0]),
        schoolId: Number(result[1]),
        studentName: result[2],
        dateOfBirth: result[3] > 0 ? new Date(Number(result[3]) * 1000).toLocaleDateString() : 'N/A',
        institutionName: result[4],
        certificateTitle: result[5],
        issueDate: result[6] > 0 ? new Date(Number(result[6]) * 1000).toLocaleDateString() : 'N/A',
        expiryDate: result[7] > 0 ? new Date(Number(result[7]) * 1000).toLocaleDateString() : 'N/A',
        documentHash: result[8],
        isRevoked: result[9]
      });
      setSearchMessage("Credential found successfully!");
      setTimeout(() => { setSearchMessage(''); }, 5000);
    } catch (err) {
      console.error("Error searching credential:", err);
      const revertReason = err.reason || err.data?.message || err.message;
      if (revertReason.includes("Credential not found")) {
        setSearchMessage("Credential not found for the given IDs.");
      } else {
        setSearchMessage(`Failed to search credential: ${revertReason}`);
      }
      setSearchResult(null);
    }
  };

  // --- NEW: Revoke Credential Function ---
  const revokeCredential = async () => {
    if (!contractInstance) {
      setRevokeMessage("Contract not initialized.");
      return;
    }
    const isRegisteredInstitution = registeredInstitutions.some(inst => inst.address.toLowerCase() === currentAccount.toLowerCase());
    if (!isOwner && !isRegisteredInstitution) {
        setRevokeMessage("Only the contract owner or a registered institution can revoke credentials.");
        return;
    }
    if (!revokeStudentId || !revokeSchoolId) {
      setRevokeMessage("Please enter both Student ID and School ID to revoke.");
      return;
    }
    setRevokeMessage("Revoking credential... Please confirm in MetaMask.");
    setError(null);

    try {
      const tx = await contractInstance.revokeCredential(revokeStudentId, revokeSchoolId);
      console.log("Revoke Credential Transaction sent:", tx.hash);
      setRevokeMessage(`Transaction sent: ${tx.hash}. Waiting for confirmation...`);

      await tx.wait();

      const successMsg = `Credential (Student ID: ${revokeStudentId}, School ID: ${revokeSchoolId}) revoked successfully!`;
      console.log("Revoke Credential success message:", successMsg);
      setRevokeMessage(successMsg);
      setTimeout(() => { setRevokeMessage(''); }, 5000);

      // Clear fields and potentially refresh search result if it was this credential
      setRevokeStudentId('');
      setRevokeSchoolId('');
      setSearchResult(null); // Clear previous search if any
    } catch (err) {
      console.error("Error revoking credential:", err);
      if (err.code === 4001) {
        setRevokeMessage("Transaction rejected by user.");
      } else {
        const revertReason = err.reason || err.data?.message || err.message;
        if (revertReason.includes("Credential not found")) {
            setRevokeMessage("Failed to revoke: Credential not found.");
        } else if (revertReason.includes("Credential is already revoked")) {
            setRevokeMessage("Failed to revoke: Credential is already revoked.");
        } else if (revertReason.includes("Only the issuing institution or contract owner can revoke this credential")) {
            setRevokeMessage("Failed to revoke: You are not the issuing institution for this credential.");
        } else {
            setRevokeMessage(`Failed to revoke credential: ${revertReason}`);
        }
      }
    }
  };

  // --- NEW: Verify Credential Function ---
  const verifyCredential = async () => {
    if (!contractInstance) {
      setVerifyMessage("Contract not initialized.");
      return;
    }
    if (!verifyStudentId || !verifySchoolId || !verifyDocumentHash) {
      setVerifyMessage("Please enter Student ID, School ID, and Document Hash to verify.");
      setVerifyResult(null);
      return;
    }
    setVerifyMessage("Verifying credential...");
    setError(null);

    try {
      const [isValid, isRevoked, isExpired] = await contractInstance.verifyCredential(
        verifyStudentId,
        verifySchoolId,
        verifyDocumentHash
      );
      console.log("Verification result:", { isValid, isRevoked, isExpired });

      setVerifyResult({ isValid, isRevoked, isExpired });
      if (isValid) {
        setVerifyMessage("Credential is VALID!");
      } else {
        let status = "Credential is INVALID: ";
        if (isRevoked) status += "It has been revoked. ";
        if (isExpired) status += "It has expired. ";
        // Only add mismatch if it's not revoked or expired but still invalid (implies hash mismatch or not found)
        if (!isValid && !isRevoked && !isExpired) status += "Document hash mismatch or not found. ";
        setVerifyMessage(status.trim()); // Trim to remove trailing space if no extra reasons
      }
      setTimeout(() => { setVerifyMessage(''); }, 8000); // Keep verification message longer
    } catch (err) {
      console.error("Error verifying credential:", err);
      const revertReason = err.reason || err.data?.message || err.message;
      setVerifyMessage(`Failed to verify credential: ${revertReason}`);
      setVerifyResult(null);
    }
  };


  return (
    <div className="App">
      <header className="App-header">
        <h1>SIRCMS Decentralized Application</h1>
        {error && <p className="error-message">{error}</p>}

        {currentAccount ? (
          <div>
            <p>Connected Account: <strong>{currentAccount}</strong></p>
            {balance !== null && <p>Account Balance (Sepolia): <strong>{balance} ETH</strong></p>}

            {contractInstance ? (
              <div>
                <p>Contract Initialized at: <strong>{CONTRACT_ADDRESS}</strong></p>
                {contractOwner && <p>Contract Owner: <strong>{contractOwner}</strong></p>}
                {isOwner && <p className="owner-indicator">You are the contract owner!</p>}
                {!isOwner && contractOwner && <p className="not-owner-indicator">You are NOT the contract owner.</p>}

                <h2>Interact with SIRCMS Contract</h2>

                {/* Tabs Navigation */}
                <div className="tabs-container">
                  {isOwner && (
                    <button
                      className={`tab-button ${selectedTab === 'registerInstitution' ? 'active' : ''}`}
                      onClick={() => setSelectedTab('registerInstitution')}
                    >
                      Register Institution
                    </button>
                  )}
                  <button
                    className={`tab-button ${selectedTab === 'viewInstitutions' ? 'active' : ''}`}
                    onClick={() => setSelectedTab('viewInstitutions')}
                  >
                    View Institutions
                  </button>
                  {/* Store Credential tab is visible if owner or registered institution */}
                  {(isOwner || registeredInstitutions.some(inst => inst.address.toLowerCase() === currentAccount.toLowerCase())) && (
                    <button
                      className={`tab-button ${selectedTab === 'storeCredential' ? 'active' : ''}`}
                      onClick={() => setSelectedTab('storeCredential')}
                    >
                      Store Credential
                    </button>
                  )}
                  <button
                    className={`tab-button ${selectedTab === 'searchCredential' ? 'active' : ''}`}
                    onClick={() => setSelectedTab('searchCredential')}
                  >
                    Search Credential
                  </button>
                  {(isOwner || registeredInstitutions.some(inst => inst.address.toLowerCase() === currentAccount.toLowerCase())) && (
                    <button
                      className={`tab-button ${selectedTab === 'revokeCredential' ? 'active' : ''}`}
                      onClick={() => setSelectedTab('revokeCredential')}
                    >
                      Revoke Credential
                    </button>
                  )}
                  <button
                    className={`tab-button ${selectedTab === 'verifyCredential' ? 'active' : ''}`}
                    onClick={() => setSelectedTab('verifyCredential')}
                  >
                    Verify Credential
                  </button>
                </div>

                {/* General Message Area - Stays above tabs and their content */}
                {message && <p className="info-message">{message}</p>}

                {/* Tab Content */}
                <div className="tab-content">
                  {selectedTab === 'registerInstitution' && isOwner && (
                    <div className="section-box">
                      <h3>Register New Institution</h3>
                      <input
                        type="text"
                        placeholder="Institution Address (e.g., 0x...)"
                        value={newInstitutionAddress}
                        onChange={(e) => setNewInstitutionAddress(e.target.value)}
                        className="input-field"
                      />
                      <input
                        type="text"
                        placeholder="Institution Name (e.g., University A)"
                        value={newInstitutionName}
                        onChange={(e) => setNewInstitutionName(e.target.value)}
                        className="input-field"
                      />
                      <input
                        type="number"
                        placeholder="Institution Code (9 digits)"
                        value={newInstitutionCode}
                        onChange={(e) => setNewInstitutionCode(e.target.value)}
                        className="input-field"
                      />
                      <button onClick={registerInstitution} className="action-button">Register Institution</button>
                    </div>
                  )}

                  {selectedTab === 'viewInstitutions' && (
                    <div className="section-box">
                      <h3>Registered Institutions</h3>
                      <button onClick={fetchAllInstitutions} className="action-button" style={{ marginBottom: '15px' }}>
                        Refresh Institutions List
                      </button>
                      {registeredInstitutions.length === 0 ? (
                        <p>No institutions registered yet.</p>
                      ) : (
                        <ul className="institution-list">
                          {registeredInstitutions.map((inst, index) => (
                            <li key={inst.address} className="institution-item">
                              <p><strong>Name:</strong> {inst.name}</p>
                              <p><strong>Address:</strong> {inst.address}</p>
                              <p><strong>Code:</strong> {inst.code}</p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {selectedTab === 'storeCredential' && (isOwner || registeredInstitutions.some(inst => inst.address.toLowerCase() === currentAccount.toLowerCase())) ? (
                    <div className="section-box">
                      <h3>Store New Credential</h3>
                      <input
                        type="number"
                        placeholder="Student ID"
                        value={newStudentId}
                        onChange={(e) => setNewStudentId(e.target.value)}
                        className="input-field"
                      />
                      <input
                        type="number"
                        placeholder="School ID"
                        value={newSchoolId}
                        onChange={(e) => setNewSchoolId(e.target.value)}
                        className="input-field"
                      />
                      <input
                        type="text"
                        placeholder="Student Name"
                        value={newStudentName}
                        onChange={(e) => setNewStudentName(e.target.value)}
                        className="input-field"
                      />
                      <label className="input-label">Date of Birth:</label>
                      <input
                        type="date"
                        value={newDateOfBirth}
                        onChange={(e) => setNewDateOfBirth(e.target.value)}
                        className="input-field"
                      />
                      <input
                        type="text"
                        placeholder="Issuing Institution Name"
                        value={newInstitutionNameCredential}
                        onChange={(e) => setNewInstitutionNameCredential(e.target.value)}
                        className="input-field"
                      />
                      <input
                        type="text"
                        placeholder="Certificate Title (e.g., Bachelor of Science)"
                        value={newCertificateTitle}
                        onChange={(e) => setNewCertificateTitle(e.target.value)}
                        className="input-field"
                      />
                      <label className="input-label">Issue Date:</label>
                      <input
                        type="date"
                        value={newIssueDate}
                        onChange={(e) => setNewIssueDate(e.target.value)}
                        className="input-field"
                      />
                      <label className="input-label">Expiry Date (optional):</label>
                      <input
                        type="date"
                        value={newExpiryDate}
                        onChange={(e) => setNewExpiryDate(e.target.value)}
                        className="input-field"
                      />
                      <input
                        type="text"
                        placeholder="Document Hash (IPFS CID/URL)"
                        value={newDocumentHash}
                        onChange={(e) => setNewDocumentHash(e.target.value)}
                        className="input-field"
                      />
                      <button onClick={storeCredential} className="action-button">Store Credential</button>
                    </div>
                  ) : selectedTab === 'storeCredential' && (
                    <div className="section-box">
                        <h3>Store New Credential</h3>
                        <p className="not-owner-indicator">
                            You must be the contract owner or a registered institution to store credentials.
                        </p>
                    </div>
                  )}

                  {/* NEW: Search Credential Tab Content */}
                  {selectedTab === 'searchCredential' && (
                    <div className="section-box">
                      <h3>Search Credential</h3>
                      <input
                        type="number"
                        placeholder="Student ID"
                        value={searchStudentId}
                        onChange={(e) => setSearchStudentId(e.target.value)}
                        className="input-field"
                      />
                      <input
                        type="number"
                        placeholder="School ID"
                        value={searchSchoolId}
                        onChange={(e) => setSearchSchoolId(e.target.value)}
                        className="input-field"
                      />
                      <button onClick={searchCredential} className="action-button">Search Credential</button>
                      {searchMessage && <p className="info-message">{searchMessage}</p>}
                      {searchResult && (
                        <div className="search-result">
                          <h4>Credential Details:</h4>
                          <p><strong>Student ID:</strong> {searchResult.studentId}</p>
                          <p><strong>School ID:</strong> {searchResult.schoolId}</p>
                          <p><strong>Student Name:</strong> {searchResult.studentName}</p>
                          <p><strong>Date of Birth:</strong> {searchResult.dateOfBirth}</p>
                          <p><strong>Institution Name:</strong> {searchResult.institutionName}</p>
                          <p><strong>Certificate Title:</strong> {searchResult.certificateTitle}</p>
                          <p><strong>Issue Date:</strong> {searchResult.issueDate}</p>
                          <p><strong>Expiry Date:</strong> {searchResult.expiryDate}</p>
                          <p><strong>Document Hash:</strong> <a href={searchResult.documentHash} target="_blank" rel="noopener noreferrer">{searchResult.documentHash}</a></p>
                          <p><strong>Revoked:</strong> {searchResult.isRevoked ? 'Yes' : 'No'}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* NEW: Revoke Credential Tab Content */}
                  {selectedTab === 'revokeCredential' && (isOwner || registeredInstitutions.some(inst => inst.address.toLowerCase() === currentAccount.toLowerCase())) ? (
                    <div className="section-box">
                      <h3>Revoke Credential</h3>
                      <input
                        type="number"
                        placeholder="Student ID to revoke"
                        value={revokeStudentId}
                        onChange={(e) => setRevokeStudentId(e.target.value)}
                        className="input-field"
                      />
                      <input
                        type="number"
                        placeholder="School ID to revoke"
                        value={revokeSchoolId}
                        onChange={(e) => setRevokeSchoolId(e.target.value)}
                        className="input-field"
                      />
                      <button onClick={revokeCredential} className="action-button">Revoke Credential</button>
                      {revokeMessage && <p className="info-message">{revokeMessage}</p>}
                    </div>
                  ) : selectedTab === 'revokeCredential' && (
                    <div className="section-box">
                        <h3>Revoke Credential</h3>
                        <p className="not-owner-indicator">
                            You must be the contract owner or a registered institution to revoke credentials.
                        </p>
                    </div>
                  )}

                  {/* NEW: Verify Credential Tab Content */}
                  {selectedTab === 'verifyCredential' && (
                    <div className="section-box">
                      <h3>Verify Credential</h3>
                      <input
                        type="number"
                        placeholder="Student ID for verification"
                        value={verifyStudentId}
                        onChange={(e) => setVerifyStudentId(e.target.value)}
                        className="input-field"
                      />
                      <input
                        type="number"
                        placeholder="School ID for verification"
                        value={verifySchoolId}
                        onChange={(e) => setVerifySchoolId(e.target.value)}
                        className="input-field"
                      />
                      <input
                        type="text"
                        placeholder="Document Hash (from the physical/digital credential)"
                        value={verifyDocumentHash}
                        onChange={(e) => setVerifyDocumentHash(e.target.value)}
                        className="input-field"
                      />
                      <button onClick={verifyCredential} className="action-button">Verify Credential</button>
                      {verifyMessage && <p className="info-message">{verifyMessage}</p>}
                      {verifyResult && (
                        <div className="verify-result">
                          <h4>Verification Status:</h4>
                          <p className={verifyResult.isValid ? 'owner-indicator' : 'error-message'}>
                            <strong>Valid:</strong> {verifyResult.isValid ? 'Yes' : 'No'}
                          </p>
                          <p><strong>Revoked:</strong> {verifyResult.isRevoked ? 'Yes' : 'No'}</p>
                          <p><strong>Expired:</strong> {verifyResult.isExpired ? 'Yes' : 'No'}</p>
                        </div>
                      )}
                    </div>
                  )}


                  <p style={{marginTop: '30px', borderTop: '1px solid #eee', paddingTop: '20px'}}>
                    This is the final set of core SIRCMS functions.
                  </p>
                </div>
              </div>
            ) : (
              <p>Initializing contract...</p>
            )}
          </div>
        ) : (
          <button onClick={connectWallet} className="connect-button">Connect Wallet</button>
        )}
      </header>
    </div>
  );
}

export default App;