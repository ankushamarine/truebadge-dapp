import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { sha256 } from 'js-sha256';
import './App.css'; // Make sure this path is correct for your styling

// --- Smart Contract Configuration ---
// IMPORTANT: This ABI has been corrected to precisely match your SIRCMS.sol contract.
// If you modify your Solidity contract, you MUST re-generate and update this ABI.
const SIRCMS_ABI = [
  // Read-only functions (view/pure)
  "function owner() view returns (address)",
  "function getAllRegisteredInstitutionAddresses() view returns (address[] memory)",
  "function institutionsData(address) view returns (address institutionAddress, string name, uint224 code, bool isRegistered)",
  "function institutionCodeExists(uint224) view returns (bool)",
  "function searchCredential(uint256 _studentId, uint256 _schoolId) view returns (uint256 studentId, uint256 schoolId, string studentName, uint256 dateOfBirth, string institutionName, string certificateTitle, uint256 issueDate, uint256 expiryDate, string documentHash, string ipfsCid, bool isRevoked)",
  "function verifyCredential(uint256 _studentId, uint256 _schoolId, string memory _documentHash) view returns (bool isValid, bool isRevoked, bool isExpired)",

  // Write functions (state-changing)
  "function registerInstitution(address _institutionAddress, string memory _name, uint224 _code)",
  "function storeCredential(uint256 _studentId, uint256 _schoolId, string memory _studentName, uint256 _dateOfBirth, string memory _institutionName, string memory _certificateTitle, uint256 _issueDate, uint256 _expiryDate, string memory _documentHash, string memory _ipfsCid)",
  "function revokeCredential(uint256 _studentId, uint256 _schoolId)",

  // Events (Match exactly from your contract)
  "event InstitutionRegistered(address indexed institutionAddress, string name, uint256 code)",
  "event CredentialStored(uint256 indexed studentId, uint256 indexed schoolId, string studentName, string institutionName, string certificateTitle, string documentHash)", // Note: ipfsCid is not in event based on your Solidity
  "event CredentialRevoked(uint256 indexed studentId, uint256 indexed schoolId)"
];

// Smart Contract Address (Replace with YOUR DEPLOYED CONTRACT ADDRESS on Sepolia)
const SIRCMS_ADDRESS = '0xA82b7F3fd0366b2B08c8d626dBdC3D2485b73abd'; // <-- REPLACE THIS WITH YOUR DEPLOYED CONTRACT ADDRESS!

// --- Pinata API Keys (WARNING: Exposing API keys in frontend is NOT secure for production) ---
const PINATA_API_KEY = 'b9e49afd18aa2c5e1276'; // <-- REPLACE WITH YOUR ACTUAL PINATA API KEY!
const PINATA_API_SECRET = '7c5da2d61b78b81b9ba050e2593be5754ff950559d24fc2e66db11b10a86938d'; // <-- REPLACE WITH YOUR ACTUAL PINATA API SECRET!

function App() {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [sircmsContract, setSircmsContract] = useState(null);
  const [connectedAccount, setConnectedAccount] = useState(null);
  const [balance, setBalance] = useState(null);
  const [contractOwner, setContractOwner] = useState(null);
  const [currentTab, setCurrentTab] = useState('home');

  // General UI state for feedback
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // State variables for various DApp functionalities
  // Register Institution
  const [newInstitutionAddress, setNewInstitutionAddress] = useState(''); // NEW: For the address to register
  const [newInstitutionName, setNewInstitutionName] = useState('');
  const [newInstitutionCode, setNewInstitutionCode] = useState(''); // NEW: Renamed from newInstitutionId to reflect 'code'
  const [checkInstitutionAddress, setCheckInstitutionAddress] = useState(''); // NEW: For checking status by address
  const [institutionRegisteredStatus, setInstitutionRegisteredStatus] = useState(null);
  const [fetchedInstitution, setFetchedInstitution] = useState(null);
  const [viewInstitutionAddress, setViewInstitutionAddress] = useState(''); // NEW: For viewing details by address

  // Store Credential
  const [studentId, setStudentId] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [studentName, setStudentName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState(''); // NEW: For dateOfBirth
  const [institutionName, setInstitutionName] = useState(''); // For credential storage (name, not address)
  const [certificateTitle, setCertificateTitle] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [documentHash, setDocumentHash] = useState('');
  const [ipfsCid, setIpfsCid] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [fileUploadMessage, setFileUploadMessage] = useState('');

  // Search Credential
  const [searchStudentId, setSearchStudentId] = useState('');
  const [searchSchoolId, setSearchSchoolId] = useState(''); // NEW: For searching by School ID
  const [fetchedCredential, setFetchedCredential] = useState(null); // Displays result of search

  // Revoke Credential
  const [revokeStudentId, setRevokeStudentId] = useState(''); // NEW: For revoking by Student ID
  const [revokeSchoolId, setRevokeSchoolId] = useState(''); // NEW: For revoking by School ID

  // Verify Credential
  const [verifyStudentId, setVerifyStudentId] = useState(''); // NEW: For verifying by Student ID
  const [verifySchoolId, setVerifySchoolId] = useState(''); // NEW: For verifying by School ID
  const [verifySelectedFile, setVerifySelectedFile] = useState(null);
  const [verifyDocumentHash, setVerifyDocumentHash] = useState('');
  const [verificationResult, setVerificationResult] = useState(null); // Stores { isValid, isRevoked, isExpired }


  // --- Wallet and Contract Connection ---
  const connectWallet = useCallback(async () => {
    setMessage('');
    setError('');
    setLoading(true);
    try {
      if (window.ethereum) {
        const _provider = new ethers.BrowserProvider(window.ethereum);
        setProvider(_provider);

        await _provider.send("eth_requestAccounts", []);
        const _signer = await _provider.getSigner();
        setSigner(_signer);

        const _connectedAccount = await _signer.getAddress();
        setConnectedAccount(_connectedAccount);

        const _sircmsContract = new ethers.Contract(SIRCMS_ADDRESS, SIRCMS_ABI, _signer);
        setSircmsContract(_sircmsContract);

        const _balance = await _provider.getBalance(_connectedAccount);
        setBalance(ethers.formatEther(_balance));

        const ownerAddress = await _sircmsContract.owner();
        setContractOwner(ownerAddress);

        setMessage('Wallet connected successfully!');
      } else {
        setError('MetaMask is not installed. Please install it to use this DApp.');
      }
    } catch (err) {
      console.error("Error connecting wallet:", err);
      setError(`Failed to connect wallet: ${err.message || 'An unknown error occurred.'}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    connectWallet();

    if (window.ethereum) {
      const handleAccountsChanged = (accounts) => {
        if (accounts.length > 0) {
          connectWallet();
        } else {
          setConnectedAccount(null); setSigner(null); setSircmsContract(null);
          setBalance(null); setContractOwner(null); setMessage('Wallet disconnected.');
        }
      };

      const handleChainChanged = (chainId) => {
        console.log('Chain changed to:', chainId);
        window.location.reload();
      };

      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);

      return () => {
        if (window.ethereum) {
          window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
          window.ethereum.removeListener('chainChanged', handleChainChanged);
        }
      };
    }
  }, [connectWallet]);


  // --- Helper Functions for UI Feedback ---
  const clearMessages = () => {
    setMessage('');
    setError('');
    setFileUploadMessage('');
  };

  const handleError = (err, action) => {
    console.error(`Error during ${action}:`, err);
    // Ethers.js specific error message extraction for 'execution reverted'
    let errorMessage = err.reason || err.data?.message || err.message || 'An unknown error occurred.';
    if (errorMessage.includes('missing revert data')) {
        errorMessage = 'Transaction reverted by contract. Check contract logic or input data.';
    } else if (errorMessage.includes('require(false)')) {
        errorMessage = 'Contract condition not met (require statement failed).';
    } else if (err.code === 'ACTION_REJECTED') {
        errorMessage = 'Transaction rejected by user.';
    }
    setError(`Failed to ${action}: ${errorMessage}`);
    setLoading(false);
  };


  // --- Institution Management Functions ---
  const registerInstitution = async () => {
    clearMessages();
    setLoading(true);
    try {
      if (!sircmsContract || !newInstitutionAddress || !newInstitutionName || !newInstitutionCode) {
        setError("Please connect wallet and fill in all institution details.");
        setLoading(false);
        return;
      }

      const parsedCode = parseInt(newInstitutionCode);
      if (isNaN(parsedCode) || parsedCode < 100000000 || parsedCode > 999999999) {
        setError("Institution Code must be a 9-digit number.");
        setLoading(false);
        return;
      }

      // Check if institution address is already registered using contract's public getter
      const existingInstitution = await sircmsContract.institutionsData(newInstitutionAddress);
      if (existingInstitution.isRegistered) { // Check the 'isRegistered' field from the returned struct
        setError("Institution with this address is already registered.");
        setLoading(false);
        return;
      }

      // Check if institution code already exists using contract's public getter
      const codeExists = await sircmsContract.institutionCodeExists(parsedCode);
      if (codeExists) {
          setError("Institution with this code is already registered.");
          setLoading(false);
          return;
      }

      // Call the contract function with correct arguments (address, string, uint224)
      const tx = await sircmsContract.registerInstitution(newInstitutionAddress, newInstitutionName, parsedCode);
      setMessage(`Registering institution... Transaction hash: ${tx.hash}`);
      await tx.wait(); // Wait for the transaction to be mined
      setMessage(`Institution "${newInstitutionName}" registered successfully!`);
      setNewInstitutionAddress('');
      setNewInstitutionName('');
      setNewInstitutionCode('');
    } catch (err) {
      handleError(err, 'registering institution');
    } finally {
      setLoading(false);
    }
  };

  const checkInstitutionRegistered = async () => {
    clearMessages();
    setLoading(true);
    setInstitutionRegisteredStatus(null);
    try {
      if (!sircmsContract || !checkInstitutionAddress) {
        setError("Please connect wallet and enter an institution Address to check.");
        setLoading(false);
        return;
      }
      // Call the public getter for institutionsData mapping
      const institutionData = await sircmsContract.institutionsData(checkInstitutionAddress);
      // The `isRegistered` field determines if it's registered
      setInstitutionRegisteredStatus(institutionData.isRegistered);
      setMessage(`Institution "${checkInstitutionAddress}" is ${institutionData.isRegistered ? 'REGISTERED' : 'NOT REGISTERED'}.`);
    } catch (err) {
      handleError(err, 'checking institution status');
    } finally {
      setLoading(false);
    }
  };

  const getInstitutionDetails = async () => {
    clearMessages();
    setLoading(true);
    setFetchedInstitution(null);
    try {
      if (!sircmsContract || !viewInstitutionAddress) {
        setError("Please connect wallet and enter an institution Address to view.");
        setLoading(false);
        return;
      }
      // Call the public getter for the mapping
      const institution = await sircmsContract.institutionsData(viewInstitutionAddress);

      // Check if the returned address is not the zero address AND if it's explicitly marked as registered
      // This is a robust check for existence in the mapping
      if (institution.institutionAddress !== ethers.ZeroAddress && institution.isRegistered) {
          setFetchedInstitution({
              institutionAddress: institution.institutionAddress, // Match Solidity struct
              name: institution.name, // Match Solidity struct
              code: Number(institution.code), // Convert BigNumber to number for display, match Solidity struct
              isRegistered: institution.isRegistered // Match Solidity struct
          });
          setMessage(`Institution details fetched for "${institution.name}".`);
      } else {
          setFetchedInstitution(null);
          setMessage(`Institution "${viewInstitutionAddress}" not found or not registered.`);
      }
    } catch (err) {
      handleError(err, 'fetching institution details');
    } finally {
      setLoading(false);
    }
  };


  // --- File Hashing and IPFS Upload ---
  const handleFileChange = (event) => {
    clearMessages();
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
      setIpfsCid('');
      setFileUploadMessage('');
      const reader = new FileReader();

      reader.onload = (e) => {
        const buffer = e.target.result;
        const hash = sha256(new Uint8Array(buffer));
        setDocumentHash(hash);
        setFileUploadMessage(`File selected and hash calculated: ${hash}`);
      };
      reader.onerror = (e) => {
        console.error("FileReader error:", e);
        setFileUploadMessage("Error reading file.");
      };
      reader.readAsArrayBuffer(file);
    } else {
      setSelectedFile(null);
      setDocumentHash('');
      setFileUploadMessage("No file selected.");
    }
  };

  const uploadDocumentToIPFS = async () => {
    if (!selectedFile) {
      setFileUploadMessage("Please select a file to upload.");
      return null;
    }
    setFileUploadMessage("Uploading to IPFS via Pinata... This may take a moment.");
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const metadata = { name: selectedFile.name };
      const options = { cidVersion: 0 };
      formData.append('pinataMetadata', JSON.stringify(metadata));
      formData.append('pinataOptions', JSON.stringify(options));

      const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
        method: 'POST',
        headers: {
          'pinata_api_key': PINATA_API_KEY,
          'pinata_secret_api_key': PINATA_API_SECRET,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => response.text());
        console.error("Pinata API Error Response:", errorBody);
        throw new Error(`Pinata API Error: ${response.status} - ${JSON.stringify(errorBody)}`);
      }

      const result = await response.json();
      const cid = result.IpfsHash;
      setIpfsCid(cid);
      setFileUploadMessage(`File uploaded to IPFS! CID: ${cid}`);
      console.log("IPFS CID:", cid);
      return cid;
    } catch (err) {
      console.error("Error uploading to IPFS via Pinata (direct fetch):", err);
      setFileUploadMessage(`Failed to upload to IPFS: ${err.message}`);
      setError(`Upload Error: ${err.message}`);
      return null;
    }
  };


  // --- Credential Management Functions ---
  const storeCredential = async () => {
    clearMessages();
    setLoading(true);
    try {
      // Basic input validation
      if (!sircmsContract || !studentId || !schoolId || !studentName || !dateOfBirth || !institutionName || !certificateTitle || !documentHash || !ipfsCid || !issueDate) {
        setError("Please fill all required fields and ensure the document is uploaded to IPFS.");
        setLoading(false);
        return;
      }

      // Convert IDs to numbers
      const studentIdNum = parseInt(studentId);
      const schoolIdNum = parseInt(schoolId);
      if (isNaN(studentIdNum) || isNaN(schoolIdNum)) {
          setError("Student ID and School ID must be valid numbers.");
          setLoading(false);
          return;
      }

      // Convert dates to Unix timestamps (seconds since epoch)
      const dobTimestamp = Math.floor(new Date(dateOfBirth).getTime() / 1000);
      const issueDateTimestamp = Math.floor(new Date(issueDate).getTime() / 1000);
      const expiryDateTimestamp = expiryDate ? Math.floor(new Date(expiryDate).getTime() / 1000) : 0;

      if (isNaN(dobTimestamp) || isNaN(issueDateTimestamp) || (expiryDate && isNaN(expiryDateTimestamp))) {
          setError("Invalid Date format. Please use Букмекерлар-MM-DD.");
          setLoading(false);
          return;
      }

      // Call the contract function with correct arguments and order
      const tx = await sircmsContract.storeCredential(
        studentIdNum,
        schoolIdNum,
        studentName,
        dobTimestamp, // Added dateOfBirth timestamp
        institutionName,
        certificateTitle,
        issueDateTimestamp,
        expiryDateTimestamp,
        documentHash,
        ipfsCid
      );
      setMessage(`Storing credential... Transaction hash: ${tx.hash}`);
      await tx.wait();
      setMessage(`Credential for ${studentName} (${certificateTitle}) stored successfully!`);

      // Clear form fields after successful storage
      setStudentId('');
      setSchoolId('');
      setStudentName('');
      setDateOfBirth(''); // Clear new field
      setInstitutionName('');
      setCertificateTitle('');
      setSelectedFile(null);
      setDocumentHash('');
      setIpfsCid('');
      setIssueDate('');
      setExpiryDate('');
      setFileUploadMessage('');

    } catch (err) {
      handleError(err, 'storing credential');
    } finally {
      setLoading(false);
    }
  };

  const searchCredential = async () => {
    clearMessages();
    setLoading(true);
    setFetchedCredential(null); // Search now returns a single credential or reverts
    try {
      // Your Solidity search takes studentId and schoolId.
      if (!sircmsContract || !searchStudentId || !searchSchoolId) {
        setError("Please fill Student ID and School ID to search for a credential.");
        setLoading(false);
        return;
      }

      const studentIdNum = parseInt(searchStudentId);
      const schoolIdNum = parseInt(searchSchoolId);
      if (isNaN(studentIdNum) || isNaN(schoolIdNum)) {
          setError("Student ID and School ID must be valid numbers.");
          setLoading(false);
          return;
      }

      const credential = await sircmsContract.searchCredential(studentIdNum, schoolIdNum);

      // If credential.studentId is 0, it means it was not found (due to require in Solidity).
      // If the call succeeds, it means it was found.
      const readableDateOfBirth = new Date(Number(credential.dateOfBirth) * 1000).toLocaleDateString();
      const readableIssueDate = new Date(Number(credential.issueDate) * 1000).toLocaleDateString();
      const readableExpiryDate = credential.expiryDate > 0 ? new Date(Number(credential.expiryDate) * 1000).toLocaleDateString() : 'N/A';

      setFetchedCredential({
        studentId: Number(credential.studentId),
        schoolId: Number(credential.schoolId),
        studentName: credential.studentName,
        dateOfBirth: readableDateOfBirth,
        institutionName: credential.institutionName,
        certificateTitle: credential.certificateTitle,
        issueDate: readableIssueDate,
        expiryDate: readableExpiryDate,
        documentHash: credential.documentHash,
        ipfsCid: credential.ipfsCid,
        isRevoked: credential.isRevoked
      });
      setMessage(`Credential found for Student ID: ${searchStudentId}, School ID: ${searchSchoolId}`);

    } catch (err) {
      handleError(err, 'searching credential');
    } finally {
      setLoading(false);
    }
  };

  // Removed getCredentialDetails function as searchCredential now handles fetching full details.
  // The ABI no longer supports getCredential(string _credentialHash).

  const revokeCredential = async () => {
    clearMessages();
    setLoading(true);
    try {
      if (!sircmsContract || !revokeStudentId || !revokeSchoolId) {
        setError("Please enter Student ID and School ID to revoke.");
        setLoading(false);
        return;
      }

      const studentIdNum = parseInt(revokeStudentId);
      const schoolIdNum = parseInt(revokeSchoolId);
      if (isNaN(studentIdNum) || isNaN(schoolIdNum)) {
          setError("Student ID and School ID must be valid numbers for revocation.");
          setLoading(false);
          return;
      }

      const tx = await sircmsContract.revokeCredential(studentIdNum, schoolIdNum);
      setMessage(`Revoking credential... Transaction hash: ${tx.hash}`);
      await tx.wait();
      setMessage(`Credential for Student ID "${revokeStudentId}" and School ID "${revokeSchoolId}" revoked successfully!`);
      setRevokeStudentId('');
      setRevokeSchoolId('');
    } catch (err) {
      handleError(err, 'revoking credential');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyFileChange = (event) => {
    clearMessages();
    const file = event.target.files[0];
    if (file) {
      setVerifySelectedFile(file);
      setVerificationResult(null);
      const reader = new FileReader();
      reader.onload = (e) => {
        const buffer = e.target.result;
        const hash = sha256(new Uint8Array(buffer));
        setVerifyDocumentHash(hash);
        setMessage("File selected and hash calculated for verification.");
      };
      reader.onerror = (e) => {
        console.error("FileReader error:", e);
        setMessage("Error reading file for verification.");
      };
      reader.readAsArrayBuffer(file);
    } else {
      setVerifySelectedFile(null);
      setVerifyDocumentHash('');
      setMessage("No file selected for verification.");
    }
  };

  const verifyCredential = async () => {
    clearMessages();
    setLoading(true);
    setVerificationResult(null);
    try {
      if (!sircmsContract || !verifyStudentId || !verifySchoolId || !verifyDocumentHash) {
        setError("Please enter Student ID, School ID and upload the document for verification.");
        setLoading(false);
        return;
      }

      const studentIdNum = parseInt(verifyStudentId);
      const schoolIdNum = parseInt(verifySchoolId);
      if (isNaN(studentIdNum) || isNaN(schoolIdNum)) {
          setError("Student ID and School ID must be valid numbers.");
          setLoading(false);
          return;
      }

      const [isValid, isRevoked, isExpired] = await sircmsContract.verifyCredential(studentIdNum, schoolIdNum, verifyDocumentHash);

      setVerificationResult({ isValid, isRevoked, isExpired });
      if (isValid) {
        setMessage("Credential verified successfully: The document hash matches the stored record, and it's not revoked or expired.");
      } else {
        let failReason = "Credential verification failed: ";
        if (isRevoked) failReason += "Credential is revoked. ";
        if (isExpired) failReason += "Credential is expired. ";
        if (!isValid && !isRevoked && !isExpired) failReason += "Document hash does NOT match or credential not found.";
        setError(failReason);
      }
    } catch (err) {
      handleError(err, 'verifying credential');
    } finally {
      setLoading(false);
    }
  };


  // --- Render UI ---
  return (
    <div className="App">
      <header className="App-header">
        <h1>SIRCMS Decentralized Application</h1>
        {connectedAccount ? (
          <div className="connection-info">
            <p>Connected Account: <strong>{connectedAccount}</strong></p>
            {balance && <p>Account Balance (Sepolia): <strong>{balance} ETH</strong></p>}
            {sircmsContract && (
                <>
                    <p>Contract Initialized at: <strong>{sircmsContract.target}</strong></p>
                    {contractOwner && (
                        <p>Contract Owner: <strong>{contractOwner}</strong></p>
                    )}
                    {connectedAccount && contractOwner && connectedAccount.toLowerCase() === contractOwner.toLowerCase() && (
                        <p className="owner-message">You are the contract owner!</p>
                    )}
                </>
            )}
          </div>
        ) : (
          <button onClick={connectWallet} disabled={loading}>
            {loading ? 'Connecting...' : 'Connect Wallet'}
          </button>
        )}

        {message && <p className="message">{message}</p>}
        {error && <p className="error">{error}</p>}
      </header>

      <nav className="tabs">
        <button onClick={() => { setCurrentTab('home'); clearMessages(); }}>Home</button>
        <button onClick={() => { setCurrentTab('register'); clearMessages(); }}>Register Institution</button>
        <button onClick={() => { setCurrentTab('view-institutions'); clearMessages(); }}>View Institutions</button>
        <button onClick={() => { setCurrentTab('store'); clearMessages(); }}>Store Credential</button>
        <button onClick={() => { setCurrentTab('search'); clearMessages(); }}>Search Credential</button>
        <button onClick={() => { setCurrentTab('revoke'); clearMessages(); }}>Revoke Credential</button>
        <button onClick={() => { setCurrentTab('verify'); clearMessages(); }}>Verify Credential</button>
      </nav>

      <main className="content">
        {currentTab === 'home' && (
          <section className="home-section">
            <h2>Welcome to SIRCMS</h2>
            <p>Your decentralized solution for secure credential management.</p>
            <p>Use the tabs above to interact with the smart contract.</p>
            <p><strong>Remember:</strong> Ensure your MetaMask wallet is connected to the Sepolia test network.</p>
            <p>For storing credentials, please upload the document to IPFS first to get the CID.</p>
          </section>
        )}

        {currentTab === 'register' && (
          <section className="register-institution-section">
            <h2>Register Institution</h2>
            <input
              type="text"
              placeholder="Institution Address (e.g., your wallet address)"
              value={newInstitutionAddress}
              onChange={(e) => setNewInstitutionAddress(e.target.value)}
            />
            <input
              type="text"
              placeholder="Institution Name"
              value={newInstitutionName}
              onChange={(e) => setNewInstitutionName(e.target.value)}
            />
            <input
              type="text"
              placeholder="Institution Code (9-digit number)"
              value={newInstitutionCode}
              onChange={(e) => setNewInstitutionCode(e.target.value)}
            />
            <button onClick={registerInstitution} disabled={loading || !connectedAccount}>
              {loading ? 'Registering...' : 'Register Institution'}
            </button>

            <h3 style={{marginTop: '20px'}}>Check Institution Status</h3>
            <input
              type="text"
              placeholder="Institution Address to Check" // Corrected placeholder
              value={checkInstitutionAddress}
              onChange={(e) => setCheckInstitutionAddress(e.target.value)} // <--- THIS LINE IS NOW CORRECTED
            />
            <button onClick={checkInstitutionRegistered} disabled={loading || !connectedAccount}>
              {loading ? 'Checking...' : 'Check Status'}
            </button>
            {institutionRegisteredStatus !== null && (
              <p>Status: {institutionRegisteredStatus ? 'Registered' : 'Not Registered'}</p>
            )}
          </section>
        )}

        {currentTab === 'view-institutions' && (
            <section className="view-institution-section">
                <h2>View Institution Details</h2>
                <input
                    type="text"
                    placeholder="Institution Address to View"
                    value={viewInstitutionAddress}
                    onChange={(e) => setViewInstitutionAddress(e.target.value)}
                />
                <button onClick={getInstitutionDetails} disabled={loading || !connectedAccount}>
                    {loading ? 'Fetching...' : 'Get Details'}
                </button>
                {fetchedInstitution && (
                    <div className="institution-details">
                        <p><strong>Address:</strong> {fetchedInstitution.institutionAddress}</p>
                        <p><strong>Name:</strong> {fetchedInstitution.name}</p>
                        <p><strong>Code:</strong> {fetchedInstitution.code}</p>
                        <p><strong>Registered:</strong> {fetchedInstitution.isRegistered ? 'Yes' : 'No'}</p>
                    </div>
                )}
            </section>
        )}

        {currentTab === 'store' && (
          <section className="store-credential-section">
            <h2>Store New Credential</h2>
            <input type="text" placeholder="Student ID (e.g., 101)" value={studentId} onChange={(e) => setStudentId(e.target.value)} />
            <input type="text" placeholder="School ID (e.g., 1001)" value={schoolId} onChange={(e) => setSchoolId(e.target.value)} />
            <input type="text" placeholder="Student Name" value={studentName} onChange={(e) => setStudentName(e.target.value)} />
            <label htmlFor="dateOfBirth">Date of Birth:</label>
            <input type="date" id="dateOfBirth" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
            <input type="text" placeholder="Issuing Institution Name (Must match registered name)" value={institutionName} onChange={(e) => setInstitutionName(e.target.value)} />
            <input type="text" placeholder="Certificate Title (e.g., Bachelor of Engineering)" value={certificateTitle} onChange={(e) => setCertificateTitle(e.target.value)} />

            <div className="file-upload-section">
              <h3>Upload Document (PDF, Image, etc.):</h3>
              <input type="file" onChange={handleFileChange} />
              {fileUploadMessage && <p className="file-upload-message">{fileUploadMessage}</p>}
              {selectedFile && <p>File Name: <strong>{selectedFile.name}</strong></p>}
              {documentHash && <p>Calculated Hash (SHA256): <strong>{documentHash}</strong></p>}
              {!ipfsCid && (
                <button onClick={uploadDocumentToIPFS} disabled={loading || !selectedFile}>
                  {loading ? 'Uploading to IPFS...' : 'Upload to IPFS (via Pinata)'}
                </button>
              )}
              {ipfsCid && <p>IPFS Document: <a href={`https://gateway.pinata.cloud/ipfs/${ipfsCid}`} target="_blank" rel="noopener noreferrer"><strong>{ipfsCid}</strong></a></p>}
            </div>

            <label htmlFor="issueDate">Issue Date:</label>
            <input type="date" id="issueDate" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
            <label htmlFor="expiryDate">Expiry Date (optional):</label>
            <input type="date" id="expiryDate" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />

            <button onClick={storeCredential} disabled={loading || !connectedAccount || !ipfsCid}>
              {loading ? 'Storing...' : 'Store Credential'}
            </button>
          </section>
        )}

        {currentTab === 'search' && (
          <section className="search-credential-section">
            <h2>Search Credential Details</h2>
            <p>Search by Student ID and School ID:</p>
            <input type="text" placeholder="Student ID" value={searchStudentId} onChange={(e) => setSearchStudentId(e.target.value)} />
            <input type="text" placeholder="School ID" value={searchSchoolId} onChange={(e) => setSearchSchoolId(e.target.value)} />
            <button onClick={searchCredential} disabled={loading || !connectedAccount}>
              {loading ? 'Searching...' : 'Search Credential'}
            </button>
            
            {fetchedCredential && (
                <div className="credential-details">
                    <h3>Credential Details:</h3>
                    <p><strong>Student ID:</strong> {fetchedCredential.studentId}</p>
                    <p><strong>School ID:</strong> {fetchedCredential.schoolId}</p>
                    <p><strong>Student Name:</strong> {fetchedCredential.studentName}</p>
                    <p><strong>Date of Birth:</strong> {fetchedCredential.dateOfBirth}</p>
                    <p><strong>Institution:</strong> {fetchedCredential.institutionName}</p>
                    <p><strong>Certificate:</strong> {fetchedCredential.certificateTitle}</p>
                    <p><strong>Document Hash:</strong> {fetchedCredential.documentHash}</p>
                    <p><strong>IPFS CID:</strong> <a href={`https://gateway.pinata.cloud/ipfs/${fetchedCredential.ipfsCid}`} target="_blank" rel="noopener noreferrer"><strong>{fetchedCredential.ipfsCid}</strong></a></p>
                    <p><strong>Issue Date:</strong> {fetchedCredential.issueDate}</p>
                    <p><strong>Expiry Date:</strong> {fetchedCredential.expiryDate}</p>
                    <p><strong>Revoked:</strong> {fetchedCredential.isRevoked ? 'Yes' : 'No'}</p>
                </div>
            )}
          </section>
        )}

        {currentTab === 'revoke' && (
          <section className="revoke-credential-section">
            <h2>Revoke Credential</h2>
            <p>Revoke by Student ID and School ID:</p>
            <input
              type="text"
              placeholder="Student ID to Revoke"
              value={revokeStudentId}
              onChange={(e) => setRevokeStudentId(e.target.value)}
            />
            <input
              type="text"
              placeholder="School ID to Revoke"
              value={revokeSchoolId}
              onChange={(e) => setRevokeSchoolId(e.target.value)}
            />
            <button onClick={revokeCredential} disabled={loading || !connectedAccount}>
              {loading ? 'Revoking...' : 'Revoke Credential'}
            </button>
          </section>
        )}

        {currentTab === 'verify' && (
          <section className="verify-credential-section">
            <h2>Verify Credential</h2>
            <p>Verify by Student ID, School ID, and Document:</p>
            <input
              type="text"
              placeholder="Student ID for Verification"
              value={verifyStudentId}
              onChange={(e) => setVerifyStudentId(e.target.value)}
            />
            <input
              type="text"
              placeholder="School ID for Verification"
              value={verifySchoolId}
              onChange={(e) => setVerifySchoolId(e.target.value)}
            />
            <h3>Upload Document for Verification:</h3>
            <input type="file" onChange={handleVerifyFileChange} />
            {verifySelectedFile && <p>File Name: <strong>{verifySelectedFile.name}</strong></p>}
            {verifyDocumentHash && <p>Calculated Hash (SHA256): <strong>{verifyDocumentHash}</strong></p>}
            <button onClick={verifyCredential} disabled={loading || !connectedAccount || !verifyDocumentHash}>
              {loading ? 'Verifying...' : 'Verify Credential'}
            </button>
            {verificationResult !== null && (
              <div className="verification-status">
                <p><strong>Overall Valid:</strong> <span className={verificationResult.isValid ? 'success-text' : 'error-text'}>{verificationResult.isValid ? 'Yes' : 'No'}</span></p>
                <p><strong>Is Revoked:</strong> <span className={verificationResult.isRevoked ? 'error-text' : 'success-text'}>{verificationResult.isRevoked ? 'Yes' : 'No'}</span></p>
                <p><strong>Is Expired:</strong> <span className={verificationResult.isExpired ? 'error-text' : 'success-text'}>{verificationResult.isExpired ? 'Yes' : 'No'}</span></p>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

export default App;