"use client";
import { useEffect, useState } from "react";
import { ethers } from "ethers";
import { coldStartAbi, coldStartAddress } from "@/utils";
import Link from "next/link";

import { Eip1193Provider } from "ethers";

interface MetaMaskEip1193Provider extends Eip1193Provider {
  on(event: 'accountsChanged', listener: (accounts: string[]) => void): this;
  removeListener(event: 'accountsChanged', listener: (accounts: string[]) => void): this;
  // We could also add 'chainChanged' listener definition here if we needed it
}

// Define the shape of the injected ethereum object
declare global {
  interface Window {
    ethereum: MetaMaskEip1193Provider;
  }
}

// Define the shape of the campaign state
enum CampaignState {
  Ongoing,
  Successful,
  Failed,
  PaidOut
}

// Define the shape of the campaign object
type Campaign = {
  id: bigint;
  creator: string;
  name: string;
  description: string;
  deadline: bigint;
  goal: bigint;
  amountRaised: bigint;
  status: CampaignState;
};

const Home = () => {
  const [currentAccount, setCurrentAccount] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignsForm, setCampaignsForm] = useState<{name: string, description: string, deadline: string, goal: string}>({name: "", description: "", deadline: "", goal: ""});
  const [isCreating, setIsCreating] = useState<boolean>(false);
  // Connect Wallet Function
  const connectWallet = async () => {
    if(isLoading) return;

    try{
      if(!window.ethereum){
        alert("Please install MetaMask!");
        return;
      }
      setIsLoading(true);
      const accounts = await (window.ethereum.request({method: "eth_requestAccounts"}));
      if(accounts.length > 0){
        setCurrentAccount(accounts[0]);
      }
    }catch(error){
        console.error("Error connecting wallet:", error);
      }finally{
        setIsLoading(false);
      }
    };
  //End of Connect Wallet Function

  // Check Wallet Connection
    useEffect(() => {
      const checkWalletConnection = async () => {
        if (window.ethereum) {
          const accounts = await (window.ethereum.request({ method: "eth_accounts" }));
          if (accounts.length > 0) {
            setCurrentAccount(accounts[0]);
          }
        }
      };
      checkWalletConnection();
    }, []);
  //End of Check Wallet Connection

    useEffect(() => {
        // Check if MetaMask is installed
        if (window.ethereum) {
            // Define the function to handle account changes
            const handleAccountsChanged = (accounts: string[]) => {
                console.log("MetaMask accounts changed:", accounts);
                if (accounts.length > 0) {
                    // User has switched to or connected a new account
                    setCurrentAccount(accounts[0]);
                } else {
                    // User has disconnected all accounts
                    console.log("User disconnected.");
                    setCurrentAccount(null);
                }
            };

            // Set up the event listener
            window.ethereum.on('accountsChanged', handleAccountsChanged);

            // This is a cleanup function that React runs when the component is unmounted.
            // It's crucial for preventing memory leaks.
            return () => {
                window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
            };
        }
    }, []);

  //Get Campaigns Function
  const fetchAllCampaigns = async () => {
    try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const contract = new ethers.Contract(coldStartAddress, coldStartAbi, provider);
        const campaignsCount = await contract.getCampaignsCount();
        
        const campaignsData = [];

        for (let i = 0; i < campaignsCount; i++) {
            const campaignRaw = await contract.campaigns(i);
            campaignsData.push({
                id: campaignRaw.id,
                creator: campaignRaw.creator,
                name: campaignRaw.name,
                description: campaignRaw.description,
                deadline: campaignRaw.deadline,
                goal: campaignRaw.goal,
                amountRaised: campaignRaw.amountRaised,
                status: campaignRaw.status,
            });
        }
        setCampaigns(campaignsData);
    } catch (error) {
        console.error("Error fetching campaigns:", error);
    }
};
  //End of Get Campaigns Function

  //Fetch All Campaigns
  useEffect(() => {
    fetchAllCampaigns();
  }, [fetchAllCampaigns]);
  //End of Fetch All Campaigns

  //Create Campaign Function
  const createCampaign = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!campaignsForm.name || !campaignsForm.goal || !campaignsForm.deadline) {
      alert("Name, Goal, and Deadline are required.");
      return;
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum!);
      // 1. GET THE SIGNER - Crucial for sending transactions
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(coldStartAddress, coldStartAbi, signer);

      // 2. CONVERT DATA TYPES
      const goalInWei = ethers.parseEther(campaignsForm.goal.toString());
      const deadlineTimestamp = Math.floor(new Date(campaignsForm.deadline).getTime() / 1000);

      if (deadlineTimestamp <= Math.floor(Date.now() / 1000)) {
        alert("Deadline must be in the future.");
        return;
      }

      setIsCreating(true);
      // 3. PASS PARAMETERS IN THE CORRECT ORDER
      const tx = await contract.createCampaign(campaignsForm.name, campaignsForm.description, goalInWei, deadlineTimestamp);
      await tx.wait();
      
      await fetchAllCampaigns(); // Refresh the list
      setCampaignsForm({ name: "", description: "", goal: "", deadline: "" }); // Clear the form
    } catch (error) {
      console.error("Error creating campaign:", error);
      alert("Error creating campaign. See console for details.");
    } finally {
      setIsCreating(false);
    }
  };
  //End of Create Campaign Function

  return (
    <main className="flex min-h-screen flex-col items-center p-8 md:p-24">
      <div className="w-full max-w-5xl">
        <div className="text-center">
          <h1 className="text-5xl font-bold">ColdStart</h1>
          <p className="text-lg text-gray-400 mt-2">Fund the future. On the blockchain.</p>
        </div>

        <div className="text-center mt-8">
          {!currentAccount ? (
            <button onClick={connectWallet} className="...">Connect Wallet</button>
          ) : (
            <p>Connected: <span className="font-mono ...">{currentAccount.substring(0, 6)}...</span></p>
          )}
        </div>

        {currentAccount && (
          <>
            {/* CREATE CAMPAIGN FORM */}
            <div className="my-12 p-6 bg-gray-900 rounded-lg shadow-xl">
              <h2 className="text-3xl font-semibold mb-4 text-center">Create a New Campaign</h2>
              <form onSubmit={createCampaign} className="space-y-4">
                <input type="text" name="name" placeholder="Campaign Name" value={campaignsForm.name} onChange={(e) => setCampaignsForm({...campaignsForm, name: e.target.value})} required className="w-full p-2 bg-gray-800 rounded border border-gray-700" />
                <textarea name="description" placeholder="Description" value={campaignsForm.description} onChange={(e) => setCampaignsForm({...campaignsForm, description: e.target.value})} className="w-full p-2 bg-gray-800 rounded border border-gray-700" />
                <div className="flex gap-4">
                  <input type="text" name="goal" placeholder="Goal (in ETH, e.g., 0.1)" value={campaignsForm.goal} onChange={(e) => setCampaignsForm({...campaignsForm, goal: e.target.value})} required className="w-1/2 p-2 bg-gray-800 rounded border border-gray-700" />
                  <input type="date" name="deadline" value={campaignsForm.deadline} onChange={(e) => setCampaignsForm({...campaignsForm, deadline: e.target.value})} required className="w-1/2 p-2 bg-gray-800 rounded border border-gray-700" />
                </div>
                <button type="submit" disabled={isCreating} className="w-full px-4 py-3 bg-green-600 ...">
                  {isCreating ? "Creating..." : "Launch Campaign"}
                </button>
              </form>
            </div>

            {/* CAMPAIGN LIST */}
            <div className="mt-12">
              <h2 className="text-3xl font-bold text-center mb-8">All Campaigns</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {campaigns.map((campaign) => (
                  <Link href={`/campaign/${campaign.id}`} key={Number(campaign.id)}>
                    <div className="bg-gray-800 p-6 rounded-lg hover:bg-gray-700 transition cursor-pointer hover:scale-105">
                        <h3 className="text-xl font-bold mb-2">{campaign.name}</h3>
                        <p className="text-gray-400 mb-4 flex-grow truncate">{campaign.description}</p>
                        <div className="text-sm text-gray-500 mb-1">
                          <span className="font-semibold">Creator:</span> {campaign.creator.substring(0, 6)}...
                        </div>
                        <div className="text-sm text-gray-500">
                          <span className="font-semibold">Deadline:</span> {new Date(Number(campaign.deadline) * 1000).toLocaleDateString()}
                        </div>
                        <div className="mt-4">
                          <div className="w-full bg-gray-700 rounded-full h-2.5">
                            <div 
                              className="bg-green-500 h-2.5 rounded-full" 
                              style={{ width: `${Math.min((Number(ethers.formatEther(campaign.amountRaised)) / Number(ethers.formatEther(campaign.goal))) * 100, 100)}%` }}
                            ></div>
                          </div>
                          <p className="mt-2 text-sm">
                            Raised: {ethers.formatEther(campaign.amountRaised)} ETH / 
                            <span className="text-gray-400"> {ethers.formatEther(campaign.goal)} ETH</span>
                          </p>
                        </div>
                        {/* We'll add contribute/withdraw buttons here later */}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
};

export default Home;