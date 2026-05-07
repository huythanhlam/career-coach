import React, { useState } from "react";
import { 
  Rocket, 
  Briefcase, 
  FileText, 
  Plus, 
  Search, 
  MoreVertical,
  Calendar,
  Building,
  ArrowUpRight,
  X,
  Zap,
  TrendingUp,
  Target,
  ShieldCheck,
  ChevronRight,
  MessageSquare
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Application {
  id: string;
  company: string;
  role: string;
  status: 'applied' | 'interviewing' | 'offer' | 'rejected' | 'pending';
  date: string;
  location: string;
}

const initialApplications: Application[] = [
  { id: '1', company: 'Google', role: 'Senior Frontend Engineer', status: 'interviewing', date: '2024-04-15', location: 'Mountain View, CA' },
  { id: '2', company: 'Meta', role: 'Staff Software Engineer', status: 'applied', date: '2024-04-12', location: 'Menlo Park, CA' },
  { id: '3', company: 'Stripe', role: 'Product Engineer', status: 'pending', date: '2024-04-20', location: 'Remote' },
];

export function Dashboard() {
  const [apps, setApps] = useState<Application[]>(initialApplications);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newApp, setNewApp] = useState<Partial<Application>>({
    company: "",
    role: "",
    status: "applied",
    location: "",
    date: new Date().toISOString().split('T')[0]
  });

  const handleAddApplication = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newApp.company || !newApp.role) return;

    const application: Application = {
      id: Math.random().toString(36).substr(2, 9),
      company: newApp.company!,
      role: newApp.role!,
      status: newApp.status as any || 'applied',
      date: newApp.date!,
      location: newApp.location || 'Remote',
    };

    setApps([application, ...apps]);
    setIsModalOpen(false);
    setNewApp({ company: "", role: "", status: "applied", location: "", date: new Date().toISOString().split('T')[0] });
  };

  const filteredApps = apps.filter(app => 
    app.company.toLowerCase().includes(search.toLowerCase()) || 
    app.role.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusColor = (status: Application['status']) => {
    switch (status) {
      case 'applied': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'interviewing': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'offer': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'rejected': return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      default: return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';
    }
  };

  return (
    <div className="flex-1 h-full overflow-y-auto bg-background p-8 lg:p-12 custom-scrollbar">
      <div className="max-w-[1400px] mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-1000">
        
        {/* Elite Header */}
        <div className="flex flex-col lg:row-span-1 lg:flex-row lg:items-end justify-between gap-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-primary font-black uppercase tracking-[0.3em] text-[10px]">
              <div className="w-1 h-1 rounded-full bg-primary animate-ping" />
              Operational Status: Active
            </div>
            <h1 className="text-5xl lg:text-6xl font-black text-foreground tracking-tighter leading-none italic uppercase">
              Mission<br/>Control
            </h1>
            <p className="text-muted-foreground max-w-md font-medium text-sm leading-relaxed">
              Analyzing <span className="text-foreground">12,402</span> market signals to accelerate your career trajectory.
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden lg:flex flex-col items-end px-6 border-r border-border">
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Next Engagement</span>
                <span className="text-sm font-bold text-foreground uppercase italic">Google Technical • 2h 40m</span>
            </div>
            <Button 
              onClick={() => setIsModalOpen(true)}
              className="h-14 px-8 bg-white text-black hover:bg-primary hover:text-white transition-all duration-500 rounded-2xl font-black uppercase tracking-tight gap-3 shadow-[0_0_40px_rgba(255,255,255,0.1)]"
            >
              <Plus className="w-5 h-5 stroke-[3]" /> Add Application
            </Button>
          </div>
        </div>

        {/* Stats Grid - Neo-Brutalist / Glass */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard title="Pipeline" value={apps.length.toString()} icon={Target} sub="Active Hunts" />
          <StatsCard title="Simulation" value="03" icon={ShieldCheck} sub="Interviews Prepped" />
          <StatsCard title="Optimization" value="28" icon={Zap} sub="Resume Iterations" />
          <StatsCard title="Success" value="15%" icon={TrendingUp} sub="Conversion Rate" />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          
          {/* Main Application Feed */}
          <div className="xl:col-span-8 space-y-6">
            <div className="flex items-center justify-between">
               <h3 className="text-xs font-black text-muted-foreground uppercase tracking-[0.4em]">Target Acquisition Feed</h3>
               <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input 
                    placeholder="Filter Targets..." 
                    className="bg-secondary/50 border border-border rounded-full pl-9 pr-4 py-2 text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all w-48"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
               </div>
            </div>
            
            <div className="grid gap-3">
               {filteredApps.map((app, i) => (
                  <div key={app.id} 
                    className="glass group p-6 rounded-3xl flex items-center justify-between hover:bg-secondary/50 transition-all duration-500 border-border hover:border-primary/20 animate-in fade-in slide-in-from-right-4 fill-mode-both"
                    style={{ animationDelay: `${i * 100}ms` }}
                  >
                    <div className="flex items-center gap-6">
                      <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center border border-border group-hover:border-primary/50 transition-colors shadow-2xl overflow-hidden relative">
                         <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                         <Building className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors relative z-10" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                           <h4 className="text-lg font-black text-foreground uppercase italic tracking-tighter">{app.company}</h4>
                           <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                        </div>
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{app.role} • {app.location}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-8">
                       <div className="text-right hidden sm:block">
                          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-tighter">Acquired</p>
                          <p className="text-xs font-bold text-foreground">{app.date}</p>
                       </div>
                       <span className={cn(
                         "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border",
                         getStatusColor(app.status)
                       )}>
                         {app.status}
                       </span>
                       <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground rounded-full">
                          <ChevronRight className="w-5 h-5" />
                       </Button>
                    </div>
                  </div>
               ))}
            </div>
          </div>

          {/* Intelligence Sidebar */}
          <div className="xl:col-span-4 space-y-8">
             <div className="space-y-4">
                <h3 className="text-xs font-black text-muted-foreground uppercase tracking-[0.4em]">Real-time Intel</h3>
                <Card className="glass border-border rounded-[2rem] overflow-hidden">
                   <CardContent className="p-8 space-y-6">
                      <div className="flex gap-4">
                         <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0 shadow-[0_0_10px_#6366f1]" />
                         <p className="text-sm font-bold text-muted-foreground leading-relaxed">
                           <span className="text-foreground">Market Anomaly:</span> Senior Software salaries in <span className="text-primary italic">Seattle</span> rose 4.2% since your last login.
                         </p>
                      </div>
                      <div className="flex gap-4">
                         <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0 shadow-[0_0_10px_#10b981]" />
                         <p className="text-sm font-bold text-muted-foreground leading-relaxed">
                           <span className="text-foreground">Audit Result:</span> Your <span className="text-emerald-500 italic">"Cloud Architecture"</span> section ranks in the top 5% for ATS compatibility.
                         </p>
                      </div>
                      <Button variant="outline" className="w-full h-12 rounded-xl border-border hover:bg-secondary text-xs font-black uppercase tracking-widest text-foreground">
                         View All Briefings
                      </Button>
                   </CardContent>
                </Card>
             </div>

             <div className="space-y-4">
                <h3 className="text-xs font-black text-muted-foreground uppercase tracking-[0.4em]">Quick Actions</h3>
                <div className="grid grid-cols-1 gap-3">
                   <ActionButton icon={FileText} label="Iterate Resume" />
                   <ActionButton icon={MessageSquare} label="Run Interview Sim" />
                   <ActionButton icon={Search} label="Scope Competitor" />
                </div>
             </div>
          </div>

        </div>
      </div>

      {/* High-Design Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-500">
          <div className="bg-card border border-border rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-500">
            <div className="p-10 border-b border-border flex justify-between items-center bg-secondary/20">
              <div>
                <h3 className="text-2xl font-black text-foreground italic uppercase tracking-tighter">New Target</h3>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">Initiate application tracking</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddApplication} className="p-10 space-y-6">
              <div className="space-y-4">
                <Input required placeholder="COMPANY NAME" value={newApp.company} onChange={e => setNewApp({...newApp, company: e.target.value})} className="h-14 bg-secondary border-border rounded-2xl px-6 font-bold placeholder:text-muted-foreground text-foreground focus:ring-primary" />
                <Input required placeholder="ROLE / TITLE" value={newApp.role} onChange={e => setNewApp({...newApp, role: e.target.value})} className="h-14 bg-secondary border-border rounded-2xl px-6 font-bold placeholder:text-muted-foreground text-foreground focus:ring-primary" />
                <Input placeholder="LOCATION" value={newApp.location} onChange={e => setNewApp({...newApp, location: e.target.value})} className="h-14 bg-secondary border-border rounded-2xl px-6 font-bold placeholder:text-muted-foreground text-foreground focus:ring-primary" />
                <Input type="date" value={newApp.date} onChange={e => setNewApp({...newApp, date: e.target.value})} className="h-14 bg-secondary border-border rounded-2xl px-6 font-bold text-foreground focus:ring-primary" />
              </div>
              <Button type="submit" className="w-full h-16 bg-primary text-primary-foreground hover:bg-foreground hover:text-background transition-all duration-500 rounded-2xl font-black uppercase tracking-widest shadow-[0_0_40px_rgba(99,102,241,0.2)]">
                Secure Target
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function StatsCard({ title, value, icon: Icon, sub }: { title: string, value: string, icon: any, sub: string }) {
  return (
    <Card className="glass border-border p-8 group hover:border-primary/30 transition-all duration-500 rounded-[2rem]">
      <div className="flex items-center justify-between mb-6">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-500">
          <Icon className="w-6 h-6 stroke-[2.5]" />
        </div>
        <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Live Status</div>
      </div>
      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] mb-1">{title}</p>
      <h3 className="text-4xl font-black text-foreground mt-1 italic tracking-tighter">{value}</h3>
      <p className="text-[10px] font-bold text-muted-foreground mt-2 uppercase tracking-widest">{sub}</p>
    </Card>
  );
}

function ActionButton({ icon: Icon, label }: { icon: any, label: string }) {
  return (
    <button className="glass w-full p-4 rounded-2xl border-border flex items-center gap-4 hover:bg-secondary hover:border-primary/30 transition-all duration-300 group">
       <div className="w-10 h-10 rounded-xl bg-background flex items-center justify-center text-muted-foreground group-hover:text-primary transition-colors">
          <Icon className="w-5 h-5" />
       </div>
       <span className="text-sm font-black text-muted-foreground group-hover:text-foreground uppercase tracking-tighter italic">{label}</span>
    </button>
  );
}
