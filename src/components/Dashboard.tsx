import React, { useState } from "react";
import { 
  Rocket, 
  Briefcase, 
  FileText, 
  CheckCircle2, 
  Clock, 
  Plus, 
  Search, 
  MoreVertical,
  Calendar,
  Building,
  ArrowUpRight,
  X
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  { id: '4', company: 'Airbnb', role: 'Lead Developer', status: 'rejected', date: '2024-03-28', location: 'San Francisco, CA' },
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
    setNewApp({
      company: "",
      role: "",
      status: "applied",
      location: "",
      date: new Date().toISOString().split('T')[0]
    });
  };

  const filteredApps = apps.filter(app => 
    app.company.toLowerCase().includes(search.toLowerCase()) || 
    app.role.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusColor = (status: Application['status']) => {
    switch (status) {
      case 'applied': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
      case 'interviewing': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
      case 'offer': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
      case 'rejected': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
      default: return 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';
    }
  };

  return (
    <div className="flex-1 h-full overflow-y-auto bg-zinc-50 dark:bg-zinc-950 p-8 custom-scrollbar">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Welcome Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">Welcome back, Career Navigator</h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-1">Here's what's happening with your job search today.</p>
          </div>
          <div className="flex gap-3">
            <Button 
              onClick={() => setIsModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm gap-2"
            >
              <Plus className="w-4 h-4" /> New Application
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard title="Active Applications" value="12" icon={Briefcase} change="+2 this week" />
          <StatsCard title="Interviews Scheduled" value="3" icon={Calendar} change="Next: Google (Tue)" />
          <StatsCard title="Resumes Tailored" value="28" icon={FileText} change="+5 this week" />
          <StatsCard title="Success Rate" value="15%" icon={Rocket} change="Top 5% of users" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Application Tracker */}
          <Card className="lg:col-span-2 border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
            <CardHeader className="border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900/50">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Application Tracker</CardTitle>
                  <CardDescription>Monitor your progress across companies.</CardDescription>
                </div>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <Input 
                    placeholder="Search companies..." 
                    className="pl-9 h-9 bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {filteredApps.map((app) => (
                  <div key={app.id} className="p-4 hover:bg-zinc-50 dark:hover:bg-zinc-900/30 transition-colors flex items-center justify-between group">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/20 group-hover:text-indigo-600 transition-colors">
                        <Building className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                          {app.company}
                          <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </h4>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">{app.role} • {app.location}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right hidden sm:block">
                        <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Applied on</p>
                        <p className="text-sm text-zinc-600 dark:text-zinc-300">{app.date}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-tight ${getStatusColor(app.status)}`}>
                        {app.status}
                      </span>
                      <Button variant="ghost" size="icon" className="text-zinc-400">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              {filteredApps.length === 0 && (
                <div className="p-12 text-center">
                  <p className="text-zinc-500">No applications found matching your search.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions & Recent Activity */}
          <div className="space-y-8">
            <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-2">
                <Button variant="outline" className="justify-start gap-3 h-12 border-zinc-200 dark:border-zinc-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600 transition-all">
                  <FileText className="w-4 h-4" /> Tailor a Resume
                </Button>
                <Button variant="outline" className="justify-start gap-3 h-12 border-zinc-200 dark:border-zinc-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600 transition-all">
                  <MessageSquare className="w-4 h-4" /> Practice Interview
                </Button>
                <Button variant="outline" className="justify-start gap-3 h-12 border-zinc-200 dark:border-zinc-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600 transition-all">
                  <Search className="w-4 h-4" /> Research Company
                </Button>
              </CardContent>
            </Card>

            <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Recent AI Insights</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <div className="space-y-4">
                    <div className="flex gap-3">
                      <div className="mt-1 w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">Market Insight:</span> Software Engineer salaries in Seattle rose by 4.2% this quarter.
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <div className="mt-1 w-2 h-2 rounded-full bg-green-500 shrink-0" />
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">Resume Tip:</span> Your "Cloud Architecture" section is strong, but could use more metrics.
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <div className="mt-1 w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">Interview Alert:</span> You have a Behavioral Interview mock scheduled for tomorrow.
                      </p>
                    </div>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

        </div>
      </div>

      {/* New Application Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Add New Application</h3>
                <p className="text-sm text-zinc-500 mt-1">Keep track of your latest career moves.</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setIsModalOpen(false)} className="rounded-full">
                <X className="w-5 h-5" />
              </Button>
            </div>
            <form onSubmit={handleAddApplication} className="p-8 space-y-6">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Company Name</label>
                    <Input 
                      required
                      placeholder="e.g. Google" 
                      value={newApp.company}
                      onChange={e => setNewApp({...newApp, company: e.target.value})}
                      className="bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Role / Title</label>
                    <Input 
                      required
                      placeholder="e.g. Senior Developer" 
                      value={newApp.role}
                      onChange={e => setNewApp({...newApp, role: e.target.value})}
                      className="bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 h-11"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Location</label>
                  <Input 
                    placeholder="e.g. Remote or New York, NY" 
                    value={newApp.location}
                    onChange={e => setNewApp({...newApp, location: e.target.value})}
                    className="bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 h-11"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Date Applied</label>
                    <Input 
                      type="date"
                      value={newApp.date}
                      onChange={e => setNewApp({...newApp, date: e.target.value})}
                      className="bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Initial Status</label>
                    <select 
                      className="w-full h-11 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      value={newApp.status}
                      onChange={e => setNewApp({...newApp, status: e.target.value as any})}
                    >
                      <option value="applied">Applied</option>
                      <option value="pending">Pending</option>
                      <option value="interviewing">Interviewing</option>
                      <option value="offer">Offer</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsModalOpen(false)} 
                  className="flex-1 h-12 border-zinc-200 dark:border-zinc-800"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  className="flex-1 h-12 bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  Save Application
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function StatsCard({ title, value, icon: Icon, change }: { title: string, value: string, icon: any, change: string }) {
  return (
    <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
            <Icon className="w-5 h-5" />
          </div>
        </div>
        <div>
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{title}</p>
          <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-1">{value}</h3>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">{change}</p>
        </div>
      </CardContent>
    </Card>
  );
}
