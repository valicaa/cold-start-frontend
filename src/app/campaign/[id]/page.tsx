"use client";

import {useState, useEffect, useCallback} from "react";
import { ethers } from "ethers";
import { usePathname } from "next/navigation";

import { coldStartAbi, coldStartAddress } from "@/utils";
import Link from "next/link";

enum CampaignState {
    Ongoing,
    Successful,
    Failed,
    PaidOut
}

type Campaign = {
    id: bigint;
    creator: string;
    name: string;
    description: string;
    deadline: bigint;
    goal: bigint;
    amountRaised: bigint;
    status: CampaignState;
}

const CampaignDetail = () => {
    const [campaign, setCampaign] = useState<Campaign | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [currentAccount, setCurrentAccount] = useState<string | null>(null);
    const [contributeAmount, setContributeAmount] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
  
    const pathname = usePathname();
    const id = pathname.split('/').pop();

    const getStatusInfo = (status: number) => {
        switch (status) {
            case 0: // Ongoing
                return { text: "Ongoing", color: "text-blue-400" };
            case 1: // Successful
                return { text: "Successful", color: "text-green-400" };
            case 2: // Failed
                return { text: "Failed", color: "text-red-400" };
            case 3: // PaidOut
                return { text: "Paid Out", color: "text-gray-500" };
            default:
                return { text: "Unknown", color: "text-gray-400" };
        }
    };

    const fetchCampaignDetails = useCallback(async () => {
        if(!id) return;
        console.log(`Fetching campaign details for ID: ${id}`);
        setIsLoading(true);
        try{
            const provider = new ethers.BrowserProvider(window.ethereum);
            const contract = new ethers.Contract(coldStartAddress, coldStartAbi, provider);
            const campaignData = await contract.campaigns(id);

            setCampaign({
                id: campaignData.id,
                creator: campaignData.creator,
                name: campaignData.name,
                description: campaignData.description,
                deadline: campaignData.deadline,
                goal: campaignData.goal,
                amountRaised: campaignData.amountRaised,
                status: campaignData.status,
            });
        } catch(error){
            console.error("Error fetching campaign details:", error);
        } finally{
            setIsLoading(false);
        }
    }, [id]);
    
    // WEB3 FUNCTIONS
    const handleContribute = async (e : React.FormEvent) => {
        e.preventDefault();
        if(!contributeAmount) return;
        try{ 
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const contract = new ethers.Contract(coldStartAddress, coldStartAbi, signer);

        setIsProcessing(true);
        const tx =await contract.contribute(id, {value: ethers.parseEther(contributeAmount)});
        await tx.wait();
        console.log("Contribution successful");
        setContributeAmount("");

        fetchCampaignDetails();
        } catch(error){
            console.error("Error contributing to campaign:", error);
            alert("Contribution failed.");
        } finally{
            setIsProcessing(false);
        }
    }
    const handleWithdraw = async () => {
        if (!id || !campaign || campaign.creator.toLowerCase() !== currentAccount?.toLowerCase()) {
          alert("You are not the creator or campaign is invalid.");
          return;
        }
        setIsProcessing(true);
        try {
          const provider = new ethers.BrowserProvider(window.ethereum!);
          const signer = await provider.getSigner();
          const contract = new ethers.Contract(coldStartAddress, coldStartAbi, signer);
          const tx = await contract.withdrawFunds(id);
          await tx.wait();
          await fetchCampaignDetails();
        } catch (error) { 
            console.error("Error withdrawing funds:", error); 
            alert("Withdrawal failed."); 
        }
        finally { 
            setIsProcessing(false); 
        }
    };
    const handleRefund = async () => {
        if (!id) return;
        setIsProcessing(true);
        try {
          const provider = new ethers.BrowserProvider(window.ethereum!);
          const signer = await provider.getSigner();
          const contract = new ethers.Contract(coldStartAddress, coldStartAbi, signer);
          const tx = await contract.claimRefund(id);
          await tx.wait();
          await fetchCampaignDetails();
        } catch (error) { 
            console.error("Error claiming refund:", error); 
            alert("Refund failed."); 
        }
        finally { 
            setIsProcessing(false); 
        }
    };
    const handleFinalize = async () => {
        if (!id) return;
        setIsProcessing(true);
        try {
          const provider = new ethers.BrowserProvider(window.ethereum!);
          const signer = await provider.getSigner();
          const contract = new ethers.Contract(coldStartAddress, coldStartAbi, signer);
          const tx = await contract.finalizeCampaign(id);
          await tx.wait();
          await fetchCampaignDetails();
        } catch (error) { 
            console.error("Error finalizing campaign:", error); 
            alert("Finalization failed."); 
        }
        finally { 
            setIsProcessing(false); 
        }
    };

    useEffect(()=>{
        const init = async () => {
            if(window.ethereum){
                const accounts = await (window.ethereum.request({method: "eth_accounts"}));
                if(accounts.length > 0){
                    setCurrentAccount(accounts[0]);
                }
            }
            fetchCampaignDetails();
        }
        init();
    }, [fetchCampaignDetails]);

    if (isLoading) return <div className="text-center p-24">Loading campaign...</div>;
    if (!campaign) return <div className="text-center p-24">Campaign not found.</div>;

    const isDeadlinePassed = Date.now() / 1000 > Number(campaign.deadline);

    return (
        <main className="flex min-h-screen flex-col items-center p-8 md:p-24">
            <div className="w-full max-w-4xl">
                <Link href="/" className="text-blue-400 hover:underline">&larr; Back to all campaigns</Link>
                <div className="text-center my-6">
                    <h1 className="text-4xl md:text-5xl font-bold mb-2">{campaign.name}</h1>
                    <p>Created by: <span className="font-mono text-sm bg-gray-800 px-2 py-1 rounded">{campaign.creator}</span></p>
                </div>
        
                {/* --- Main content grid --- */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Left Side - Description */}
                    <div className="md:col-span-2 bg-gray-800 p-6 rounded-lg shadow-lg">
                        <h2 className="text-2xl font-bold mb-4">Story</h2>
                        <p className="text-gray-300 whitespace-pre-wrap">{campaign.description}</p>
                    </div>
                
                    {/* Right Side - Stats and Actions */}
                    <div className="bg-gray-800 p-6 rounded-lg shadow-lg flex flex-col">
                        {/* Progress Bar & Stats */}
                        <div> 
                            <div className="mt-4">
                                <div className="w-full bg-gray-700 rounded-full h-2.5">
                                    <div 
                                        className="bg-green-500 h-2.5 rounded-full" 
                                        style={{ width: `${Math.min((Number(ethers.formatEther(campaign.amountRaised)) / Number(ethers.formatEther(campaign.goal))) * 100, 100)}%` }}
                                    />
                                </div>
                                    <p className="mt-2 text-sm">
                                        Raised: {ethers.formatEther(campaign.amountRaised)} ETH / 
                                        <span className="text-gray-400"> {ethers.formatEther(campaign.goal)} ETH</span>
                                    </p>
                            </div>
                            <div>
                                <p>Status: <span className={`font-bold ${getStatusInfo(Number(campaign.status)).color}`}>{getStatusInfo(Number(campaign.status)).text}</span></p>
                            </div>
                            <div className="text-sm text-gray-500">
                                <span className="font-semibold">Deadline:</span> {new Date(Number(campaign.deadline) * 1000).toLocaleDateString()}
                            </div>
                        </div>
                        
                        <div className="mt-6 flex-grow flex flex-col justify-end">
                            {/* Conditional Action Block */}
                            {Number(campaign.status) === 0 && !isDeadlinePassed && (
                                <form onSubmit={handleContribute}>
                                    <div className="flex items-center gap-4">
                                        <input
                                            type="text"
                                            name="contributeAmount"
                                            className="w-full p-2 bg-gray-800 rounded border border-gray-700"
                                            placeholder="0.1 ETH"
                                            value={contributeAmount}
                                            onChange={(e) => setContributeAmount(e.target.value)}
                                            required
                                        />
                                        <button
                                            type="submit"
                                            disabled={isProcessing}
                                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-500"
                                        >
                                            {isProcessing ? "Contributing..." : "Contribute"}
                                        </button>
                                    </div>
                                </form>
                            )}
                            {Number(campaign.status) === 0 && isDeadlinePassed && <button onClick={handleFinalize} disabled={isProcessing}>{isProcessing ? "Finalizing..." : "Finalize Campaign"}</button>}
                            {Number(campaign.status) === 1 && currentAccount?.toLowerCase() === campaign.creator.toLowerCase() && <button onClick={handleWithdraw} disabled={isProcessing}>{isProcessing ? "Withdrawing..." : "Withdraw Funds"}</button>}
                            {Number(campaign.status) === 2 && <button onClick={handleRefund} disabled={isProcessing}>{isProcessing ? "Processing..." : "Claim Refund"}</button>}
                            {Number(campaign.status) === 3 && <p className="text-center text-gray-500 font-bold">Funds have been paid out.</p>}
                        </div>
                    </div>
                </div>
            </div>
        </main>
      );
}

export default CampaignDetail;